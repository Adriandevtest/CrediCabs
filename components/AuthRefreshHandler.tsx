'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function AuthRefreshHandler() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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
  }, [router]);

  return null;
}
