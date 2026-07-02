'use client';
import { useEffect, useRef, useState } from 'react';

export function BackPrevention() {
  const [showToast, setShowToast] = useState(false);
  const lastBack = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let removeListener: (() => void) | null = null;

    const init = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { App } = await import('@capacitor/app');

        const handle = await App.addListener('backButton', ({ canGoBack }) => {
          // Si hay historial de navegación → simplemente volver
          if (canGoBack) {
            window.history.back();
            return;
          }

          // Sin historial → patrón "presiona dos veces para salir"
          const now = Date.now();
          if (now - lastBack.current < 2000) {
            App.exitApp();
            return;
          }

          lastBack.current = now;
          if (toastTimer.current) clearTimeout(toastTimer.current);
          setShowToast(true);
          toastTimer.current = setTimeout(() => setShowToast(false), 2000);
        });

        removeListener = () => handle.remove();
      } catch {
        /* no es nativo — ignorar */
      }
    };

    init();
    return () => {
      removeListener?.();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  if (!showToast) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-full text-white text-sm font-medium shadow-xl pointer-events-none"
      style={{
        bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))',
        background: 'rgba(30,30,30,0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)',
        whiteSpace: 'nowrap',
      }}
    >
      <i className="fa-solid fa-arrow-left mr-2 text-xs opacity-60" />
      Presiona atrás de nuevo para salir
    </div>
  );
}
