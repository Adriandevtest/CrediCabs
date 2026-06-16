import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendPushToAdmins } from '@/lib/sendPush';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const clienteId = formData.get('cliente_id') as string;
    const creditoId = formData.get('credito_id') as string;
    const pagoId = formData.get('pago_id') as string | null;
    const monto = parseFloat(formData.get('monto') as string);
    const file = formData.get('comprobante') as File;

    if (!clienteId || !creditoId || !file || isNaN(monto)) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo no puede superar 10 MB' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const filename = `transferencias/${clienteId}_${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from('expedientes')
      .upload(filename, bytes, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage
      .from('expedientes')
      .getPublicUrl(filename);

    const { data, error } = await supabaseAdmin
      .from('transferencias')
      .insert({
        cliente_id: clienteId,
        credito_id: creditoId,
        pago_diario_id: pagoId || null,
        comprobante_url: urlData.publicUrl,
        monto,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (error) throw error;

    // Notify admin
    const { data: prof } = await supabaseAdmin.from('profiles').select('nombre_completo').eq('id', clienteId).single();
    const nombre = prof?.nombre_completo || 'Un cliente';
    const msgAdmin = `${nombre} envió un comprobante de $${Number(monto).toLocaleString('es-MX')}`;
    await supabaseAdmin.from('notificaciones').insert({
      destinatario_rol: 'admin',
      titulo: 'Nuevo comprobante de pago',
      mensaje: msgAdmin,
      tipo: 'transferencia',
      referencia_id: data.id,
    }).then(() => {});

    // Push nativa a todos los admins
    sendPushToAdmins('💳 Nuevo comprobante de pago', msgAdmin).catch(() => {});

    return NextResponse.json({ success: true, transferencia: data });
  } catch (error: any) {
    console.error('Error en transferencias/crear:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
