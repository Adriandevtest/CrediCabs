import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/requireAdmin';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('userId') as string;
    const nombre = formData.get('nombre') as string;
    const avatarFile = formData.get('avatar') as File | null;

    if (!userId || !nombre) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }

    // Cualquier usuario autenticado puede editar su propio perfil (UserNav);
    // solo un admin puede editar el perfil de alguien más (alta de personal).
    const auth = await requireAuth();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (auth.userId !== userId && auth.rol !== 'admin') {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let avatarUrl: string | null = null;

    // Subir avatar si se incluyó un archivo
    if (avatarFile && avatarFile.size > 0) {
      // Always store as .jpg to avoid undefined extension on mobile camera files
      const filePath = `avatars/${userId}.jpg`;
      const buffer = Buffer.from(await avatarFile.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from('expedientes')
        .upload(filePath, buffer, {
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (uploadError) throw uploadError;

      const { data } = supabaseAdmin.storage.from('expedientes').getPublicUrl(filePath);
      // Cache-bust so browsers don't serve stale image from same path
      avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
    }

    // Update nombre first (always safe)
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ nombre_completo: nombre })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Update avatar_url separately so a column-missing error doesn't block the name update
    if (avatarUrl) {
      await supabaseAdmin.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
      // foto_url may not exist in all setups — ignore silently if it fails
      await supabaseAdmin.from('profiles').update({ foto_url: avatarUrl }).eq('id', userId).then(() => {});
    }

    return NextResponse.json({ success: true, avatar_url: avatarUrl });
  } catch (error: any) {
    console.error('Error en update-profile API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
