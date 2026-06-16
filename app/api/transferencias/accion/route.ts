import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendPushToCliente } from '@/lib/sendPush';

export async function POST(request: Request) {
  try {
    const { transferenciaId, pagoId, accion } = await request.json();

    if (!transferenciaId || !accion) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch transferencia completa para notificaciones y fallback
    const { data: trans } = await supabaseAdmin
      .from('transferencias')
      .select('cliente_id, credito_id, monto')
      .eq('id', transferenciaId)
      .single();

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
          .update({ pagado: true })
          .eq('id', pagoEfectivoId);
        if (pagoError) throw pagoError;
      }
      const { error } = await supabaseAdmin
        .from('transferencias')
        .update({ estado: 'aprobado' })
        .eq('id', transferenciaId);
      if (error) throw error;

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
