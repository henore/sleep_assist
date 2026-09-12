import { Platform } from 'react-native';

// DeviceCheck (iOS) / Play Integrity (Android) native bridge interface.
// Requires a native module to actually communicate with Apple/Google servers.
// The server verifies the token and reads/writes the two persistent bits.

export async function generateDeviceToken(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  // TODO: native bridge — DCDevice.current.generateToken()
  return null;
}

export async function queryTrialBit(apiBase: string): Promise<boolean> {
  const token = await generateDeviceToken();
  if (!token) return false;
  try {
    const res = await fetch(`${apiBase}/device-check/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    return data.trialUsedBefore === true;
  } catch {
    return false;
  }
}

export async function setTrialBit(apiBase: string): Promise<void> {
  const token = await generateDeviceToken();
  if (!token) return;
  try {
    await fetch(`${apiBase}/device-check/set-trial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {}
}
