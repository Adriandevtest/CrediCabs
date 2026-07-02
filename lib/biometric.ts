import { Preferences } from '@capacitor/preferences';

const K_EMAIL = 'bio_email';
const K_PASS = 'bio_pass';
const K_ENABLED = 'bio_enabled';

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    const result = await BiometricAuth.checkBiometry();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const { value } = await Preferences.get({ key: K_ENABLED });
  return value === 'true';
}

export async function saveBiometricCredentials(email: string, password: string): Promise<void> {
  await Promise.all([
    Preferences.set({ key: K_EMAIL, value: email }),
    Preferences.set({ key: K_PASS, value: password }),
    Preferences.set({ key: K_ENABLED, value: 'true' }),
  ]);
}

export async function getBiometricCredentials(): Promise<{ email: string; password: string } | null> {
  const [{ value: email }, { value: pass }] = await Promise.all([
    Preferences.get({ key: K_EMAIL }),
    Preferences.get({ key: K_PASS }),
  ]);
  if (!email || !pass) return null;
  return { email, password: pass };
}

export async function clearBiometricCredentials(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: K_EMAIL }),
    Preferences.remove({ key: K_PASS }),
    Preferences.set({ key: K_ENABLED, value: 'false' }),
  ]);
}

export async function promptBiometric(): Promise<boolean> {
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    await BiometricAuth.authenticate({
      reason: 'Confirma tu identidad para acceder a CrediCabs',
      cancelTitle: 'Cancelar',
      allowDeviceCredential: false,
      iosFallbackTitle: 'Usar contraseña',
    });
    return true;
  } catch {
    return false;
  }
}
