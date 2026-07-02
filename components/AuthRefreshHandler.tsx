'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const RUTAS_PUBLICAS = ['/login', '/descargar', '/panel-cliente'];

export function AuthRefreshHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const esPublica = RUTAS_PUBLICAS.some(r => pathname.startsWith(r));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (esPublica) return;

      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
      // Sesión inicial nula = token expirado en cookie o sin sesión activa
      if (event === 'INITIAL_SESSION' && !session) {
        router.replace('/login');
      }
      // Refresh fallido → Supabase emite SIGNED_OUT, pero capturamos el error
      // de red explícitamente por si el evento no llega
      if (event === 'TOKEN_REFRESHED' && !session) {
        router.replace('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [router, pathname]);

  return null;
}
