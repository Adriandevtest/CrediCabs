'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import UserNav from '../../components/UserNav';

const MapaCobradoresLive = dynamic(
  () => import('../../components/MapaCobradoresLive'),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando mapa...</p>
        </div>
      </div>
    ),
  }
);

export default function MapaPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      supabase.from('profiles').select('rol').eq('id', user.id).single().then(({ data }) => {
        if (data?.rol !== 'admin') { router.push('/login'); return; }
        setLoading(false);
      });
    });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 md:px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-gray-400 hover:text-white transition-colors"
            title="Volver al dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-white font-black text-lg leading-tight">Rastreo en Vivo</h1>
            <p className="text-gray-500 text-[10px] uppercase tracking-widest">Cobradores · Asesores</p>
          </div>
        </div>

        {/* Nav rápido escritorio */}
        <nav className="hidden md:flex items-center gap-1">
          <Link href="/" className="px-3 py-1.5 text-gray-400 hover:text-yellow-500 text-sm transition-colors">Dashboard</Link>
          <Link href="/clientes" className="px-3 py-1.5 text-gray-400 hover:text-yellow-500 text-sm transition-colors">Clientes</Link>
          <Link href="/equipo" className="px-3 py-1.5 text-gray-400 hover:text-yellow-500 text-sm transition-colors">Equipo</Link>
          <Link href="/bandeja" className="px-3 py-1.5 text-gray-400 hover:text-yellow-500 text-sm transition-colors">Bandeja</Link>
          <Link href="/mapa" className="px-3 py-1.5 border-b-2 border-yellow-500 text-yellow-400 text-sm font-bold">Mapa</Link>
        </nav>

        <UserNav />
      </header>

      {/* Mapa ocupa todo el resto de la pantalla */}
      <div className="flex-1 flex flex-col p-4 md:p-6 gap-4">
        <MapaCobradoresLive fullscreen />
      </div>

    </div>
  );
}
