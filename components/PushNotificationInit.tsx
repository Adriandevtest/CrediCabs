'use client';

import { useEffect, useState, useCallback } from 'react';

interface ToastNotif {
  title: string;
  body: string;
  id: number;
}

export function PushNotificationInit() {
  const [toasts, setToasts] = useState<ToastNotif[]>([]);

  const showToast = useCallback((title: string, body: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { title, body, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  useEffect(() => {
    initPush(showToast);
  }, [showToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[200] flex flex-col gap-2 p-3 pointer-events-none"
         style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className="bg-gray-900/95 backdrop-blur-sm text-white rounded-2xl px-4 py-3 shadow-xl flex items-start gap-3 pointer-events-auto animate-in slide-in-from-top-2 duration-300"
        >
          <span className="text-xl shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{t.title}</p>
            <p className="text-xs text-gray-300 mt-0.5 leading-snug line-clamp-2">{t.body}</p>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-gray-400 hover:text-white shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

async function initPush(showToast: (title: string, body: string) => void) {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    const { PushNotifications } = await import('@capacitor/push-notifications');

    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { data: { user } } = await supabase.auth.getUser();
        const clienteId = typeof window !== 'undefined' ? localStorage.getItem('cliente_id') : null;

        if (!user && !clienteId) return;

        await fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token.value,
            userId: user?.id ?? null,
            clienteId: clienteId ?? null,
          }),
        });
      } catch (e) {
        console.error('[Push] registration listener error:', e);
      }
    });

    // Notificación en primer plano → mostrar banner en la app
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const title = notification.title ?? 'CrediCabs';
      const body = notification.body ?? '';
      showToast(title, body);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', () => {
      // El usuario tocó la notificación — aquí se puede navegar si se necesita
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] registration error:', err);
    });
  } catch {
    // Entorno no-Capacitor — ignorar silenciosamente
  }
}
