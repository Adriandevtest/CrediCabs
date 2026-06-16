'use client';

import { useEffect } from 'react';

export function PushNotificationInit() {
  useEffect(() => {
    initPush();
  }, []);

  return null;
}

async function initPush() {
  // Only run in Capacitor native context
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;

    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Check/request permission
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;

    await PushNotifications.register();

    // On token received — save it to server
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

    // Handle notification received while app is open (foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] foreground notification:', notification);
    });

    // Handle tap on notification
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] notification tapped:', action);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] registration error:', err);
    });
  } catch (e) {
    // Not in Capacitor environment — silently skip
  }
}
