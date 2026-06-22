import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendPushToAdmins, sendPushToUserIds } from '@/lib/sendPush';

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pnesuibfgtescgudkerf.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZXN1aWJmZ3Rlc2NndWRrZXJmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTU4MjMyMSwiZXhwIjoyMDk1MTU4MzIxfQ.tmiI8NHQiGDnZkjRgz_tXwjY3kVjiP7g2JmqMp38BhM';
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

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

    // Datos del cliente y asesor del crédito
    const { data: prof } = await supabaseAdmin.from('profiles').select('nombre_completo').eq('id', clienteId).single();
    const nombre = prof?.nombre_completo || 'Un cliente';
    const msgNuevo = `${nombre} envió un comprobante de $${Number(monto).toLocaleString('es-MX')}`;

    // Buscar asesor que creó el crédito y cobrador asignado al cliente
    const [{ data: credito }, { data: clienteRow }] = await Promise.all([
      supabaseAdmin.from('creditos').select('creado_por').eq('id', creditoId).single(),
      supabaseAdmin.from('clientes').select('cobrador_asignado_id').eq('id', clienteId).single(),
    ]);
    const asesorId: string | null = credito?.creado_por ?? null;
    const cobradorId: string | null = clienteRow?.cobrador_asignado_id ?? null;

    // Notificación in-app al admin
    await supabaseAdmin.from('notificaciones').insert({
      destinatario_rol: 'admin',
      titulo: 'Nuevo comprobante de pago',
      mensaje: msgNuevo,
      tipo: 'transferencia',
      referencia_id: data.id,
    }).then(() => {});

    // Notificación in-app al asesor
    if (asesorId) {
      await supabaseAdmin.from('notificaciones').insert({
        destinatario_id: asesorId,
        titulo: 'Nuevo comprobante de pago',
        mensaje: msgNuevo,
        tipo: 'transferencia',
        referencia_id: data.id,
      }).then(() => {});
    }

    // Push nativa: admins + asesor + cobrador
    sendPushToAdmins('💳 Nuevo comprobante', msgNuevo).catch(() => {});
    const staffIds = [asesorId, cobradorId].filter(Boolean) as string[];
    if (staffIds.length) sendPushToUserIds(staffIds, '💳 Nuevo comprobante', msgNuevo).catch(() => {});

    return NextResponse.json({ success: true, transferencia: data });
  } catch (error: any) {
    console.error('Error en transferencias/crear:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
