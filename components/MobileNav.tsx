'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Páginas donde no se muestra ningún nav
const OCULTAR_EN = ['/login', '/panel-cliente', '/mapa', '/descargar'];

const ASESOR_TABS = [
  { hash: '',              label: 'Nueva',       icon: 'fa-solid fa-file-circle-plus' },
  { hash: '#solicitudes',  label: 'Solicitudes', icon: 'fa-solid fa-list-check' },
  { hash: '#perfil',       label: 'Perfil',      icon: 'fa-solid fa-user' },
] as const;

const COBRADOR_TABS = [
  { hash: '',           label: 'Ruta',      icon: 'fa-solid fa-route' },
  { hash: '#historial', label: 'Historial', icon: 'fa-solid fa-clock-rotate-left' },
  { hash: '#mapa',      label: 'Mapa',      icon: 'fa-solid fa-location-dot' },
  { hash: '#perfil',    label: 'Perfil',    icon: 'fa-solid fa-user' },
] as const;

const ADMIN_TABS = [
  { path: '/',         label: 'Inicio',   icon: 'fa-solid fa-house' },
  { path: '/clientes', label: 'Clientes', icon: 'fa-solid fa-address-book' },
  { path: '/equipo',   label: 'Equipo',   icon: 'fa-solid fa-users' },
  { path: '/bandeja',  label: 'Bandeja',  icon: 'fa-solid fa-envelope' },
] as const;

export default function MobileNav() {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activeHash, setActiveHash] = useState('');
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  // Ocultar cuando el teclado virtual abre
  useEffect(() => {
    const handleResize = () => setKeyboardOpen(window.innerHeight < 400);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ocultar al bajar, mostrar al subir
  useEffect(() => {
    const handleScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const currentY = window.scrollY;
        if (currentY < 60) {
          setHidden(false);
        } else if (currentY > lastScrollY.current + 8) {
          setHidden(true);
        } else if (currentY < lastScrollY.current - 8) {
          setHidden(false);
        }
        lastScrollY.current = currentY;
        ticking.current = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Seguir el hash actual para el nav del cobrador
  useEffect(() => {
    const readHash = () => setActiveHash(window.location.hash);
    readHash();
    window.addEventListener('hashchange', readHash);
    return () => window.removeEventListener('hashchange', readHash);
  }, [pathname]);

  if (OCULTAR_EN.includes(pathname) || keyboardOpen) return null;

  // ── NAV ASESOR ────────────────────────────────────────────
  if (pathname === '/supervisor') {
    return (
      <nav className={`fixed left-4 right-4 md:hidden z-[45] h-16 bg-white rounded-3xl flex items-center justify-around px-2 shadow-2xl border border-gray-100 transition-transform duration-300 ${hidden ? 'translate-y-28' : 'translate-y-0'}`}
        style={{ bottom: 'max(1rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}>
        {ASESOR_TABS.map(({ hash, label, icon }) => {
          const isActive = activeHash === hash || (hash === '' && (activeHash === '' || activeHash === '#nueva'));
          return (
            <a
              key={label}
              href={`/supervisor${hash}`}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-4 relative transition-colors ${isActive ? 'text-yellow-500' : 'text-gray-400'}`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-yellow-500 rounded-full" />
              )}
              <i className={`${icon} text-xl`} />
              <span className="text-[9px] font-medium">{label}</span>
            </a>
          );
        })}
      </nav>
    );
  }

  // ── NAV COBRADOR ──────────────────────────────────────────
  if (pathname === '/cobrador') {
    return (
      <nav className={`fixed left-4 right-4 md:hidden z-[45] h-16 bg-white rounded-3xl flex items-center justify-around px-2 shadow-2xl border border-gray-100 transition-transform duration-300 ${hidden ? 'translate-y-28' : 'translate-y-0'}`}
        style={{ bottom: 'max(1rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}>
        {COBRADOR_TABS.map(({ hash, label, icon }) => {
          const isActive = activeHash === hash || (hash === '' && (activeHash === '' || activeHash === '#ruta'));
          return (
            <a
              key={label}
              href={`/cobrador${hash}`}
              className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 relative transition-colors ${isActive ? 'text-red-600' : 'text-gray-400'}`}
            >
              {isActive && (
                <span className="absolute -top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-red-600 rounded-full" />
              )}
              <i className={`${icon} text-xl`} />
              <span className="text-[9px] font-medium">{label}</span>
            </a>
          );
        })}
      </nav>
    );
  }

  // ── NAV ADMIN (resto de páginas) ──────────────────────────
  return (
    <nav className={`fixed left-4 right-4 md:hidden z-[45] h-16 bg-white rounded-3xl flex items-center justify-around px-2 shadow-2xl border border-gray-100 transition-transform duration-300 ${hidden ? 'translate-y-28' : 'translate-y-0'}`}
      style={{ bottom: 'max(1rem, calc(0.5rem + env(safe-area-inset-bottom, 0px)))' }}>
      {ADMIN_TABS.map(({ path, label, icon }) => {
        const isActive = pathname === path;
        return (
          <Link
            key={path}
            href={path}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-4 relative transition-colors ${isActive ? 'text-red-600' : 'text-gray-400'}`}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-red-600 rounded-full" />
            )}
            <i className={`${icon} text-xl`} />
            <span className="text-[9px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
