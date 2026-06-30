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
    });

    // Broadcast en tiempo real — necesario para que NotifBell del admin actualice
    // (postgres_changes es poco fiable; el broadcast es garantizado desde servidor)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: [{ topic: 'notif-admin', event: 'nueva_notif', payload: {} }] }),
      });
    } catch { }

    // Push nativa a admins
    sendPushToAdmins(titulo, mensaje).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[push] pago-registrado error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
