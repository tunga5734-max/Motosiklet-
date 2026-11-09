import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROFILE } from '../services/motoEta';
import { can, limits, type Feature, type Plan, type Tier } from '../subscription/plans';
import { purchaseService, type Entitlement } from '../subscription/purchases';
import type { LatLng, RiderProfile } from '../types';

export interface Favorite {
  id: string;
  name: string;
  location: LatLng;
}

export interface Destination {
  name: string;
  location: LatLng;
}

interface AppState {
  ready: boolean;
  tier: Tier;
  entitlement: Entitlement;
  can: (f: Feature) => boolean;
  purchase: (planId: Plan['id']) => Promise<void>;
  restore: () => Promise<void>;
  cancelSubscription: () => Promise<void>;

  /** Kullanıcının kaydettiği profil */
  profile: RiderProfile;
  /** Üyeliğe göre uygulanan profil (ücretsizde standart şerit arası seviye) */
  effectiveProfile: RiderProfile;
  setProfile: (p: RiderProfile) => void;

  favorites: Favorite[];
  /** Limit aşılırsa false döner */
  addFavorite: (f: Favorite) => boolean;
  removeFavorite: (id: string) => void;

  /** Topluluk "moto dostu" oyları (yerel) */
  votes: Record<string, number>;
  toggleVote: (placeId: string) => void;

  /** Başka ekrandan haritaya gönderilen hedef */
  pendingDestination: Destination | null;
  setPendingDestination: (d: Destination | null) => void;
}

const Ctx = createContext<AppState | null>(null);

const K = { profile: 'motorota.profile', favorites: 'motorota.favorites', votes: 'motorota.votes' };

async function load<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [entitlement, setEntitlement] = useState<Entitlement>({ tier: 'free' });
  const [profile, setProfileState] = useState<RiderProfile>(DEFAULT_PROFILE);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [pendingDestination, setPendingDestination] = useState<Destination | null>(null);

  useEffect(() => {
    (async () => {
      const [ent, prof, favs, v] = await Promise.all([
        purchaseService.getEntitlement().catch(() => ({ tier: 'free' }) as Entitlement),
        load(K.profile, DEFAULT_PROFILE),
        load<{ list: Favorite[] }>(K.favorites, { list: [] }),
        load<Record<string, number>>(K.votes, {}),
      ]);
      setEntitlement(ent);
      setProfileState(prof);
      setFavorites(favs.list);
      setVotes(v);
      setReady(true);
    })();
  }, []);

  const tier = entitlement.tier;

  const setProfile = useCallback((p: RiderProfile) => {
    setProfileState(p);
    AsyncStorage.setItem(K.profile, JSON.stringify(p)).catch(() => {});
  }, []);

  const effectiveProfile = useMemo<RiderProfile>(
    () =>
      can(tier, 'riderProfile')
        ? profile
        : { ...profile, filtering: DEFAULT_PROFILE.filtering, useShoulder: false },
    [tier, profile],
  );

  const persistFavs = (list: Favorite[]) =>
    AsyncStorage.setItem(K.favorites, JSON.stringify({ list })).catch(() => {});

  const addFavorite = useCallback(
    (f: Favorite) => {
      if (favorites.some((x) => x.id === f.id)) return true;
      if (favorites.length >= limits[tier].favorites) return false;
      const list = [...favorites, f];
      setFavorites(list);
      persistFavs(list);
      return true;
    },
    [favorites, tier],
  );

  const removeFavorite = useCallback(
    (id: string) => {
      const list = favorites.filter((f) => f.id !== id);
      setFavorites(list);
      persistFavs(list);
    },
    [favorites],
  );

  const toggleVote = useCallback((placeId: string) => {
    setVotes((prev) => {
      const next = { ...prev };
      if (next[placeId]) delete next[placeId];
      else next[placeId] = 1;
      AsyncStorage.setItem(K.votes, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value: AppState = {
    ready,
    tier,
    entitlement,
    can: (f) => can(tier, f),
    purchase: async (planId) => setEntitlement(await purchaseService.purchase(planId)),
    restore: async () => setEntitlement(await purchaseService.restore()),
    cancelSubscription: async () => setEntitlement(await purchaseService.cancel()),
    profile,
    effectiveProfile,
    setProfile,
    favorites,
    addFavorite,
    removeFavorite,
    votes,
    toggleVote,
    pendingDestination,
    setPendingDestination,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
