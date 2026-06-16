import { createClient } from '@supabase/supabase-js';
import { getFirebaseMessaging } from './firebase-admin';

const supabaseAdmin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function sendPushToAdmins(title: string, body: string, data?: Record<string, string>) {
  const db = supabaseAdmin();
  const { data: profiles } = await db.from('profiles').select('id').eq('rol', 'admin');
  if (!profiles?.length) return;
  const ids = profiles.map((p: any) => p.id);
  await sendPushToUserIds(ids, title, body, data);
}

export async function sendPushToCliente(clienteId: string, title: string, body: string, data?: Record<string, string>) {
  const db = supabaseAdmin();
  const { data: rows } = await db.from('push_tokens').select('token').eq('cliente_id', clienteId);
  if (!rows?.length) return;
  await dispatchTokens(rows.map((r: any) => r.token), title, body, data);
}

export async function sendPushToUserIds(userIds: string[], title: string, body: string, data?: Record<string, string>) {
  const db = supabaseAdmin();
  const { data: rows } = await db.from('push_tokens').select('token').in('user_id', userIds);
  if (!rows?.length) return;
  await dispatchTokens(rows.map((r: any) => r.token), title, body, data);
}

async function dispatchTokens(tokens: string[], title: string, body: string, data?: Record<string, string>) {
  const fcm = getFirebaseMessaging();
  if (!fcm || !tokens.length) return;

  try {
    await fcm.sendEachForMulticast({
      tokens,
      notification: { title, body },
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'default' },
      },
      data: data ?? {},
    });
  } catch (e) {
    console.error('[Push] Error sending FCM:', e);
  }
}
