import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendPushToCliente, sendPushToUserIds } from '@/lib/sendPush';

const MORA_POR_DIA = 50;

export async function POST(request: Request) {
  try {
    const { transferenciaId, pagoId, accion, mora = 0 } = await request.json();

    if (!transferenciaId || !accion) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch transferencia — sin join a creditos para evitar fallo si la FK no está configurada
    const { data: trans, error: transError } = await supabaseAdmin
      .from('transferencias')
      .select('cliente_id, credito_id, monto')
      .eq('id', transferenciaId)
      .single();

    if (transError || !trans) {
      return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 });
    }

    // Buscar cobrador y supervisor en paralelo
    const [clienteRow, creditoRow] = await Promise.all([
      supabaseAdmin.from('clientes').select('cobrador_asignado_id').eq('id', trans.cliente_id).single(),
      trans.credito_id
        ? supabaseAdmin.from('creditos').select('creado_por').eq('id', trans.credito_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const cobradorId: string | null = clienteRow.data?.cobrador_asignado_id ?? null;
    const supervisorId: string | null = (creditoRow as any).data?.creado_por ?? null;

    const broadcastHeaders = {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    if (accion === 'aprobar') {
      const today = new Date().toISOString().split('T')[0];

      // Marcar TODOS los pagos vencidos del crédito como pagados, igual que hace el cobrador.
      // Si el cliente envió un comprobante que el admin aprobó, se entiende que cubre
      // la cuota actual + la mora acumulada de días anteriores.
      let pagosActualizados = 0;
      if (trans?.credito_id) {
        const { data: pagosVencidos } = await supabaseAdmin
          .from('pagos_diarios')
          .select('id, fecha_esperada')
          .eq('credito_id', trans.credito_id)
          .eq('pagado', false)
          .lte('fecha_esperada', today)
          .order('numero_dia', { ascending: true });

        if (pagosVencidos && pagosVencidos.length > 0) {
          for (const pago of pagosVencidos) {
            const esHoy = pago.fecha_esperada === today;
            const { error: errPago } = await supabaseAdmin
              .from('pagos_diarios')
              .update({ pagado: true, mora: esHoy ? 0 : MORA_POR_DIA })
              .eq('id', pago.id);
            if (errPago) throw errPago;
            pagosActualizados++;
          }
        } else if (pagoId) {
          // No hay vencidos pero viene un pagoId específico (pago de hoy sin atraso)
          const { error: errPago } = await supabaseAdmin
            .from('pagos_diarios')
            .update({ pagado: true, mora: 0 })
            .eq('id', pagoId);
          if (errPago) throw errPago;
          pagosActualizados++;
        }
      }

      // Marcar transferencia como aprobada
      const { error } = await supabaseAdmin
        .from('transferencias')
        .update({ estado: 'aprobado' })
        .eq('id', transferenciaId);
      if (error) throw error;

      // Verificar si era el último pago y liquidar crédito
      if (trans?.credito_id) {
        const { count } = await supabaseAdmin
          .from('pagos_diarios')
          .select('id', { count: 'exact', head: true })
          .eq('credito_id', trans.credito_id)
          .eq('pagado', false);
        if (count !== null && count === 0) {
          await supabaseAdmin
            .from('creditos')
            .update({ estado: 'liquidado' })
            .eq('id', trans.credito_id);
        }
      }

      const montoFmt = `$${Number(trans?.monto).toLocaleString('es-MX')}`;

      // Broadcast en tiempo real — AWAIT obligatorio: en Vercel la función se cierra
      // al devolver la respuesta y un fetch sin await nunca se completa.
      const broadcastMessages: { topic: string; event: string; payload: object }[] = [
        { topic: 'admin-pagos',  event: 'pago_aprobado', payload: {} },
        { topic: 'notif-admin',  event: 'nueva_notif',   payload: {} },
      ];
      if (trans?.cliente_id) {
        broadcastMessages.push({ topic: `pagos-cliente-${trans.cliente_id}`, event: 'pago_aprobado', payload: {} });
        broadcastMessages.push({ topic: `notif-${trans.cliente_id}`,         event: 'nueva_notif',   payload: {} });
      }
      if (cobradorId) {
        broadcastMessages.push({ topic: `pagos-cobrador-${cobradorId}`, event: 'pago_aprobado', payload: {} });
        broadcastMessages.push({ topic: `notif-${cobradorId}`,          event: 'nueva_notif',   payload: {} });
      }
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
          method: 'POST', headers: broadcastHeaders,
          body: JSON.stringify({ messages: broadcastMessages }),
        });
      } catch { /* no bloquear la respuesta si falla el broadcast */ }

      // Notificar al CLIENTE
      if (trans?.cliente_id) {
        const msgCliente = `Tu pago de ${montoFmt} fue verificado y aprobado. Ya está registrado en tu cuenta.`;
        await supabaseAdmin.from('notificaciones').insert({
          destinatario_id: trans.cliente_id,
          titulo: '¡Pago confirmado! ✓',
          mensaje: msgCliente,
          tipo: 'pago',
        });
        sendPushToCliente(trans.cliente_id, '✅ ¡Pago confirmado!', msgCliente).catch(() => {});
      }

      // Notificar al COBRADOR — para que le aparezca el pago al abrir la app
      if (cobradorId) {
        const nombreCliente = trans?.cliente_id ? await supabaseAdmin
          .from('profiles')
          .select('nombre_completo')
          .eq('id', trans.cliente_id)
          .single()
          .then(({ data }) => data?.nombre_completo || 'Un cliente') : 'Un cliente';
        const msgCobrador = `${nombreCliente} realizó una transferencia de ${montoFmt} que fue aprobada por el admin.`;
        await supabaseAdmin.from('notificaciones').insert({
          destinatario_id: cobradorId,
          titulo: 'Pago de transferencia aprobado',
          mensaje: msgCobrador,
          tipo: 'pago',
        });
        sendPushToUserIds([cobradorId], '💳 Pago aprobado', msgCobrador).catch(() => {});
      }

      // Notificar al SUPERVISOR
      if (supervisorId) {
        sendPushToUserIds([supervisorId], '✅ Pago aprobado', `Pago de ${montoFmt} aprobado.`).catch(() => {});
      }

    } else if (accion === 'rechazar') {
      const { error } = await supabaseAdmin
        .from('transferencias')
        .update({ estado: 'rechazado' })
        .eq('id', transferenciaId);
      if (error) throw error;

      const montoFmt = `$${Number(trans?.monto).toLocaleString('es-MX')}`;

      if (trans?.cliente_id) {
        const msgRechazado = 'Tu comprobante no pudo ser verificado. Por favor contacta a tu cobrador.';
        await supabaseAdmin.from('notificaciones').insert({
          destinatario_id: trans.cliente_id,
          titulo: 'Comprobante rechazado',
          mensaje: msgRechazado,
          tipo: 'info',
        });
        sendPushToCliente(trans.cliente_id, '❌ Comprobante rechazado', msgRechazado).catch(() => {});
      }

      if (supervisorId) {
        sendPushToUserIds([supervisorId], '❌ Comprobante rechazado', `Un comprobante de ${montoFmt} fue rechazado.`).catch(() => {});
      }

      // Notificar al cobrador del rechazo también
      if (cobradorId) {
        sendPushToUserIds([cobradorId], '❌ Comprobante rechazado', `Un comprobante fue rechazado. El cliente debe pagar en efectivo.`).catch(() => {});
      }

      // Broadcast de rechazo (para que NotifBell actualice en tiempo real)
      const rechazoBroadcast: { topic: string; event: string; payload: object }[] = [];
      if (trans?.cliente_id) rechazoBroadcast.push({ topic: `notif-${trans.cliente_id}`, event: 'nueva_notif', payload: {} });
      if (cobradorId)        rechazoBroadcast.push({ topic: `notif-${cobradorId}`,        event: 'nueva_notif', payload: {} });
      rechazoBroadcast.push({ topic: 'notif-admin', event: 'nueva_notif', payload: {} });
      if (rechazoBroadcast.length) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
            method: 'POST', headers: broadcastHeaders,
            body: JSON.stringify({ messages: rechazoBroadcast }),
          });
        } catch {}
      }

    } else {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en transferencias/accion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
