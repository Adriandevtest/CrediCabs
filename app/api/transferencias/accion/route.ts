import { createClient } from '@supabase/supabase-js';
import { NextResponse, after } from 'next/server';
import { sendPushToCliente, sendPushToUserIds } from '@/lib/sendPush';
import { requireAdmin } from '@/lib/requireAdmin';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { transferenciaId, pagoId, accion } = await request.json();

    if (!transferenciaId || !accion) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const broadcastHeaders = {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    if (accion === 'aprobar') {
      // aprobar_transferencia() hace TODAS las escrituras (pagos_diarios,
      // transferencias, creditos) dentro de una sola transacción de Postgres —
      // si algo falla a mitad de camino, se revierte todo, no queda estado a medias.
      const { data: rpcRows, error: rpcError } = await supabaseAdmin
        .rpc('aprobar_transferencia', { p_transferencia_id: transferenciaId, p_pago_id: pagoId ?? null });

      if (rpcError) {
        if (rpcError.message?.includes('no encontrada')) {
          return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 });
        }
        throw rpcError;
      }

      const trans = rpcRows?.[0];
      if (!trans) throw new Error('aprobar_transferencia no devolvió resultado');

      const cobradorId: string | null = trans.cobrador_id ?? null;
      const supervisorId: string | null = trans.supervisor_id ?? null;
      const montoFmt = `$${Number(trans.monto).toLocaleString('es-MX')}`;

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
        after(() => sendPushToCliente(trans.cliente_id, '✅ ¡Pago confirmado!', msgCliente).catch((e) => {
          console.error('[push] Error notificando al cliente:', e);
        }));
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
        after(() => sendPushToUserIds([cobradorId], '💳 Pago aprobado', msgCobrador).catch((e) => {
          console.error('[push] Error notificando al cobrador:', e);
        }));
      }

      // Notificar al SUPERVISOR
      if (supervisorId) {
        after(() => sendPushToUserIds([supervisorId], '✅ Pago aprobado', `Pago de ${montoFmt} aprobado.`).catch((e) => {
          console.error('[push] Error notificando al supervisor:', e);
        }));
      }

    } else if (accion === 'rechazar') {
      const { data: rpcRows, error: rpcError } = await supabaseAdmin
        .rpc('rechazar_transferencia', { p_transferencia_id: transferenciaId });

      if (rpcError) {
        if (rpcError.message?.includes('no encontrada')) {
          return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 });
        }
        throw rpcError;
      }

      const trans = rpcRows?.[0];
      if (!trans) throw new Error('rechazar_transferencia no devolvió resultado');

      const cobradorId: string | null = trans.cobrador_id ?? null;
      const supervisorId: string | null = trans.supervisor_id ?? null;
      const montoFmt = `$${Number(trans.monto).toLocaleString('es-MX')}`;

      if (trans?.cliente_id) {
        const msgRechazado = 'Tu comprobante no pudo ser verificado. Por favor contacta a tu cobrador.';
        await supabaseAdmin.from('notificaciones').insert({
          destinatario_id: trans.cliente_id,
          titulo: 'Comprobante rechazado',
          mensaje: msgRechazado,
          tipo: 'info',
        });
        after(() => sendPushToCliente(trans.cliente_id, '❌ Comprobante rechazado', msgRechazado).catch((e) => {
          console.error('[push] Error notificando rechazo al cliente:', e);
        }));
      }

      if (supervisorId) {
        after(() => sendPushToUserIds([supervisorId], '❌ Comprobante rechazado', `Un comprobante de ${montoFmt} fue rechazado.`).catch((e) => {
          console.error('[push] Error notificando rechazo al supervisor:', e);
        }));
      }

      // Notificar al cobrador del rechazo también
      if (cobradorId) {
        after(() => sendPushToUserIds([cobradorId], '❌ Comprobante rechazado', `Un comprobante fue rechazado. El cliente debe pagar en efectivo.`).catch((e) => {
          console.error('[push] Error notificando rechazo al cobrador:', e);
        }));
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
