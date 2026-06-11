'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Detectar cuando el teclado abre/cierra
    const handleResize = () => {
      // Si la altura de la ventana es menor a cierto umbral, asumimos teclado abierto
      if (window.innerHeight < 400) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (pathname === '/login' || !isVisible) return null;

  const getIconClass = (path: string) => 
    `p-2 transition-all duration-300 ${pathname === path ? 'text-white scale-110 drop-shadow-lg' : 'text-black/60 hover:text-black'}`;

  const handleLogout = async () => {
    if (confirm('¿Deseas cerrar sesión?')) {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <nav className="fixed bottom-4 left-4 right-4 md:hidden z-[100] h-16 bg-[#ca1444] rounded-3xl flex items-center justify-around px-2 shadow-2xl border border-white/10">
      <Link href="/" className={getIconClass('/')} title="Inicio">
        <i className="fa-solid fa-house text-2xl"></i>
      </Link>
      <Link href="/clientes" className={getIconClass('/clientes')} title="Clientes">
        <i className="fa-solid fa-address-book text-2xl"></i>
      </Link>
      <div className="-mt-10 bg-white p-4 rounded-full border-[6px] border-gray-950 shadow-2xl flex items-center justify-center">
        <Link href="/equipo" className="text-[#6a918a]" title="Equipo">
          <i className="fa-solid fa-users text-2xl"></i>
        </Link>
      </div>
      <Link href="/bandeja" className={getIconClass('/bandeja')} title="Bandeja">
        <i className="fa-solid fa-envelope text-2xl"></i>
      </Link>
      <button onClick={handleLogout} className="p-2 text-black/60 hover:text-red-700 transition-all duration-300" title="Cerrar Sesión">
        <i className="fa-solid fa-right-from-bracket text-2xl"></i>
      </button>
    </nav>
  );
}