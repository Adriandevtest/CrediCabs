import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendPushToCliente, sendPushToUserIds } from '@/lib/sendPush';

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

    // Fetch transferencia + asesor del crédito
    const { data: trans } = await supabaseAdmin
      .from('transferencias')
      .select('cliente_id, credito_id, monto, creditos(creado_por)')
      .eq('id', transferenciaId)
      .single();

    const asesorId: string | null = (trans as any)?.creditos?.creado_por ?? null;

    if (accion === 'aprobar') {
      // Resolver qué pago marcar: usar pago_diario_id si existe,
      // si no, buscar el primer pendiente del crédito (fallback robusto)
      let pagoEfectivoId = pagoId || null;
      if (!pagoEfectivoId && trans?.credito_id) {
        const { data: nextPago } = await supabaseAdmin
          .from('pagos_diarios')
          .select('id')
          .eq('credito_id', trans.credito_id)
          .eq('pagado', false)
          .order('numero_dia', { ascending: true })
          .limit(1)
          .single();
        pagoEfectivoId = nextPago?.id || null;
      }

      if (pagoEfectivoId) {
        const { error: pagoError } = await supabaseAdmin
          .from('pagos_diarios')
          .update({ pagado: true, mora: mora ?? 0 })
          .eq('id', pagoEfectivoId);
        if (pagoError) throw pagoError;
      }

      const { error } = await supabaseAdmin
        .from('transferencias')
        .update({ estado: 'aprobado' })
        .eq('id', transferenciaId);
      if (error) throw error;

      // Verificar si era el último pago pendiente y liquidar el crédito
      if (trans?.credito_id) {
        const { count } = await supabaseAdmin
          .from('pagos_diarios')
          .select('id', { count: 'exact', head: true })
          .eq('credito_id', trans.credito_id)
          .eq('pagado', false);
        if (count === 0) {
          await supabaseAdmin
            .from('creditos')
            .update({ estado: 'liquidado' })
            .eq('id', trans.credito_id);
        }
      }

      // Notify cliente
      if (trans?.cliente_id) {
        const msgAprobado = `Tu pago de $${Number(trans.monto).toLocaleString('es-MX')} fue verificado y aprobado.`;
        await supabaseAdmin.from('notificaciones').insert({
          destinatario_id: trans.cliente_id,
          titulo: '¡Pago confirmado! ✓',
          mensaje: msgAprobado,
          tipo: 'pago',
        });
        sendPushToCliente(trans.cliente_id, '✅ ¡Pago confirmado!', msgAprobado).catch(() => {});
        if (asesorId) sendPushToUserIds([asesorId], '✅ Pago aprobado', `Pago de $${Number(trans.monto).toLocaleString('es-MX')} aprobado.`).catch(() => {});
      }
    } else if (accion === 'rechazar') {
      const { error } = await supabaseAdmin
        .from('transferencias')
        .update({ estado: 'rechazado' })
        .eq('id', transferenciaId);
      if (error) throw error;

      // Notify cliente
      if (trans?.cliente_id) {
        const msgRechazado = 'Tu comprobante no pudo ser verificado. Por favor contacta a tu cobrador.';
        await supabaseAdmin.from('notificaciones').insert({
          destinatario_id: trans.cliente_id,
          titulo: 'Comprobante rechazado',
          mensaje: msgRechazado,
          tipo: 'info',
        });
        sendPushToCliente(trans.cliente_id, '❌ Comprobante rechazado', msgRechazado).catch(() => {});
        if (asesorId) sendPushToUserIds([asesorId], '❌ Comprobante rechazado', `Un comprobante de $${Number(trans.monto).toLocaleString('es-MX')} fue rechazado.`).catch(() => {});
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
