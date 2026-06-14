'use client';
import { useEffect } from 'react';

export function BackPrevention() {
  useEffect(() => {
    // Solo se ejecuta una vez por sesión
    if (sessionStorage.getItem('_backGuard')) return;
    sessionStorage.setItem('_backGuard', '1');

    // Inserta una entrada "centinela" debajo de la página actual.
    // Cuando el botón atrás de Android llegaría a salir de la app,
    // choca con este centinela y rebotamos hacia adelante en su lugar.
    const href = window.location.href;
    window.history.pushState({ _noExit: true }, '', href);
    window.history.pushState(null, '', href);

    const handler = (e: PopStateEvent) => {
      if (e.state?._noExit) {
        window.history.go(1); // rebota — se queda en la app
      }
    };

    window.addEventListener('popstate', handler);
    // No cleanup intencional — queremos que persista toda la sesión
  }, []);

  return null;
}
