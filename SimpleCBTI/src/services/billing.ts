import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PURCHASED_KEY = 'pro_purchased';

export const PRODUCT_IDS = {
  MONTHLY: 'simplecbti_pro_monthly',
  SIX_MONTH: 'simplecbti_pro_6month',
} as const;

export const PLAN_INFO = [
  { id: PRODUCT_IDS.MONTHLY, price: '$10.99', period: 'month', periodJa: '月' },
  { id: PRODUCT_IDS.SIX_MONTH, price: '$49.99', period: '6 months', periodJa: '6か月' },
] as const;

type IAP = typeof import('react-native-iap');
let iap: IAP | null = null;
let connected = false;

async function getIAP(): Promise<IAP> {
  if (!iap) {
    iap = await import('react-native-iap');
  }
  return iap;
}

export async function initBilling(): Promise<boolean> {
  try {
    const mod = await getIAP();
    await mod.initConnection();
    connected = true;
    return true;
  } catch {
    return false;
  }
}

export async function fetchSubscriptions() {
  try {
    const mod = await getIAP();
    if (!connected) await initBilling();
    const products = await mod.fetchProducts({
      skus: [PRODUCT_IDS.MONTHLY, PRODUCT_IDS.SIX_MONTH],
      type: 'subs',
    });
    return products;
  } catch {
    return [];
  }
}

export async function purchase(sku: string): Promise<boolean> {
  try {
    const mod = await getIAP();
    if (!connected) await initBilling();
    await mod.requestPurchase({
      request: Platform.select({
        android: { google: { skus: [sku] } },
        ios: { apple: { sku } },
        default: {},
      }) as any,
      type: 'subs',
    });
    return true;
  } catch {
    return false;
  }
}

export async function restore(): Promise<boolean> {
  try {
    const mod = await getIAP();
    if (!connected) await initBilling();
    await mod.restorePurchases();
    const active = await mod.hasActiveSubscriptions([
      PRODUCT_IDS.MONTHLY,
      PRODUCT_IDS.SIX_MONTH,
    ]);
    if (active) {
      await AsyncStorage.setItem(PURCHASED_KEY, 'true');
    }
    return active;
  } catch {
    return false;
  }
}

export async function checkPurchased(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(PURCHASED_KEY);
    if (stored === 'true') return true;

    const mod = await getIAP();
    if (!connected) await initBilling();
    const active = await mod.hasActiveSubscriptions([
      PRODUCT_IDS.MONTHLY,
      PRODUCT_IDS.SIX_MONTH,
    ]);
    if (active) {
      await AsyncStorage.setItem(PURCHASED_KEY, 'true');
    }
    return active;
  } catch {
    return false;
  }
}

export async function markPurchased(): Promise<void> {
  await AsyncStorage.setItem(PURCHASED_KEY, 'true');
}

export async function endBilling(): Promise<void> {
  try {
    const mod = await getIAP();
    await mod.endConnection();
    connected = false;
  } catch {}
}
