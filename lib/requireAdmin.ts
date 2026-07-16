import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type AuthResult =
  | { authorized: true; userId: string; rol: string }
  | { authorized: false; status: 401 | 403; error: string };

// Todas las rutas bajo app/api/admin/* (y app/api/transferencias/accion) corren
// con la Service Role Key y antes NO verificaban quién las llamaba — cualquiera
// que conociera la URL podía resetear contraseñas, crear usuarios, modificar
// créditos o aprobar/rechazar transferencias sin haber iniciado sesión.
// requireAuth() valida sesión + trae el rol; requireAdmin() además exige 'admin'.
export async function requireAuth(): Promise<AuthResult> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          /* no-op: solo verificamos sesión, no la refrescamos aquí */
        },
        remove() {
          /* no-op */
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { authorized: false, status: 401, error: 'No autenticado.' };
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  return { authorized: true, userId: user.id, rol: profile?.rol ?? '' };
}

export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth();
  if (!auth.authorized) return auth;
  if (auth.rol !== 'admin') {
    return { authorized: false, status: 403, error: 'No autorizado.' };
  }
  return auth;
}
