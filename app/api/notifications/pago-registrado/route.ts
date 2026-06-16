import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { sendPushToAdmins } from '@/lib/sendPush';

export async function POST(request: NextRequest) {
  try {
    const { clienteNombre, monto, cobradorId } = await request.json();
    if (!clienteNombre) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const montoStr = monto ? ` ($${Number(monto).toLocaleString('es-MX')})` : '';
    const titulo = '💰 Pago registrado';
    const mensaje = `${clienteNombre} realizó su pago${montoStr}`;

    // Notificación in-app a admins
    await supabaseAdmin.from('notificaciones').insert({
      destinatario_rol: 'admin',
      titulo,
      mensaje,
      tipo: 'pago',
    }).then(() => {});

    // Push nativa a admins
    sendPushToAdmins(titulo, mensaje).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[push] pago-registrado error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
