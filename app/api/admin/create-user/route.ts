import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireAdmin';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { email, password, nombre, telefono, rol } = await request.json();

    if (!email || !password || !nombre || !rol) {
      return NextResponse.json({ error: 'Faltan datos obligatorios.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'El formato del correo no es válido.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres.' }, { status: 400 });
    }
    const rolesValidos = ['admin', 'cobrador', 'supervisor', 'cliente'];
    if (!rolesValidos.includes(rol)) {
      return NextResponse.json({ error: 'Rol no válido.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Crear el usuario en Auth sin iniciar sesión en el cliente
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar el email para acceso inmediato
      user_metadata: {
        nombre_completo: nombre,
        rol: rol
      }
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('No se pudo crear el usuario en Auth.');

    // 2. Crear el registro inicial en la tabla profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        nombre_completo: nombre,
        telefono: telefono,
        email: email,
        rol: rol
      });

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (error: any) {
    console.error("Error en create-user API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
