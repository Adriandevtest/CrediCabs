import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const nombre = formData.get('nombre') as string;
    const avatarFile = formData.get('avatar') as File | null;

    if (!userId || !nombre) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let avatarUrl: string | null = null;

    // Subir avatar si se incluyó un archivo
    if (avatarFile && avatarFile.size > 0) {
      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `avatars/${userId}.${fileExt}`;
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from('expedientes')
        .upload(filePath, buffer, {
          upsert: true,
          contentType: avatarFile.type,
        });

      if (uploadError) throw uploadError;

      const { data } = supabaseAdmin.storage.from('expedientes').getPublicUrl(filePath);
      // Cache-bust so browsers don't serve stale image from the same path
      avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    }

    // Construir los datos de actualización
    const updateData: Record<string, string> = { nombre_completo: nombre };
    if (avatarUrl) {
      updateData.avatar_url = avatarUrl;
      updateData.foto_url   = avatarUrl; // keep both fields in sync
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, avatar_url: avatarUrl });
  } catch (error: any) {
    console.error('Error en update-profile API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
