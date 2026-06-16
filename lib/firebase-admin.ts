import admin from 'firebase-admin';

let messaging: admin.messaging.Messaging | null = null;

export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  if (messaging) return messaging;

  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  messaging = admin.messaging();
  return messaging;
}
