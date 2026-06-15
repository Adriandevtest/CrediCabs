import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

    if (accion === 'aprobar') {
      if (pagoId) {
        const { error: pagoError } = await supabaseAdmin
          .from('pagos_diarios')
          .update({ pagado: true })
          .eq('id', pagoId);
        if (pagoError) throw pagoError;
      }
      const { error } = await supabaseAdmin
        .from('transferencias')
        .update({ estado: 'aprobado' })
        .eq('id', transferenciaId);
      if (error) throw error;
    } else if (accion === 'rechazar') {
      const { error } = await supabaseAdmin
        .from('transferencias')
        .update({ estado: 'rechazado' })
        .eq('id', transferenciaId);
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error en transferencias/accion:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
