/**
 * Satın alma servisi soyutlaması.
 *
 * Mağaza içi satın alma (App Store / Google Play) yalnızca native build'de çalışır.
 * Üretimde `StorePurchaseService` yerine RevenueCat (react-native-purchases) veya
 * expo-iap ile bir uygulama yazılıp `purchaseService` değiştirilmelidir; arayüz aynıdır.
 * Geliştirme sürümünde satın alma yerel olarak simüle edilir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Plan } from './plans';
import type { Tier } from './plans';

export interface Entitlement {
  tier: Tier;
  planId?: Plan['id'];
  expiresAt?: string;
}

export interface PurchaseService {
  readonly isSimulated: boolean;
  getEntitlement(): Promise<Entitlement>;
  purchase(planId: Plan['id']): Promise<Entitlement>;
  restore(): Promise<Entitlement>;
  cancel(): Promise<Entitlement>;
}

const KEY = 'motorota.entitlement';

class SimulatedPurchaseService implements PurchaseService {
  readonly isSimulated = true;

  async getEntitlement(): Promise<Entitlement> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { tier: 'free' };
    const e = JSON.parse(raw) as Entitlement;
    if (e.expiresAt && new Date(e.expiresAt) < new Date()) return { tier: 'free' };
    return e;
  }

  async purchase(planId: Plan['id']): Promise<Entitlement> {
    const days = planId === 'moto_plus_yearly' ? 365 : 30;
    const e: Entitlement = {
      tier: 'premium',
      planId,
      expiresAt: new Date(Date.now() + days * 86400_000).toISOString(),
    };
    await AsyncStorage.setItem(KEY, JSON.stringify(e));
    return e;
  }

  restore(): Promise<Entitlement> {
    return this.getEntitlement();
  }

  async cancel(): Promise<Entitlement> {
    await AsyncStorage.removeItem(KEY);
    return { tier: 'free' };
  }
}

export const purchaseService: PurchaseService = new SimulatedPurchaseService();
