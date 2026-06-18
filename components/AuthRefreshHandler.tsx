'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export function AuthRefreshHandler() {
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login');
      }
    });

    // Si al montar ya hay un error de refresh token, limpiarlo
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        supabase.auth.signOut().finally(() => router.replace('/login'));
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
