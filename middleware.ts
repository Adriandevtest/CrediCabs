import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // PASAMOS LOS VALORES DIRECTAMENTE AQUÍ PARA PRUEBA
  const supabaseUrl = "https://pnesuibfgtescgudkerf.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZXN1aWJmZ3Rlc2NndWRrZXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIzMjEsImV4cCI6MjA5NTE1ODMyMX0.V8s-7a9pNSEPZm0rUS9iQB156OeE9h5ASjp02Qyv2cw"; // REEMPLAZA ESTO CON TU CLAVE REAL

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  const { data: { session }, error } = await supabase.auth.getSession();

  // Refresh token inválido o expirado → limpiar cookies y mandar al login
  if (error) {
    const loginUrl = new URL('/login', request.url);
    const clearResponse = NextResponse.redirect(loginUrl);
    request.cookies.getAll()
      .filter(c => c.name.startsWith('sb-'))
      .forEach(c => clearResponse.cookies.delete(c.name));
    return clearResponse;
  }

  // Lógica de protección
  const { pathname } = request.nextUrl;
  if (!session &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/panel-cliente') &&
      !pathname.startsWith('/descargar') &&
      !pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};