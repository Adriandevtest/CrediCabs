import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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