import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPlaces } from '../services/places';
import type { LatLng, Place } from '../types';
import { haversine } from '../utils/geo';

/**
 * Merkez etrafındaki motosiklet mekanlarını getirir. Merkez yarıçapın %30'undan
 * fazla kaymadıkça yeniden istek atmaz (Overpass kullanım kurallarına saygı).
 * Topluluk oyları ağ isteği gerektirmeden yerelde puana eklenir.
 */
export function usePlaces(center: LatLng | null, radiusM: number, votes: Record<string, number>) {
  const [basePlaces, setBasePlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetch = useRef<{ center: LatLng; radiusM: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!center) return;
    const prev = lastFetch.current;
    if (prev && prev.radiusM === radiusM && haversine(prev.center, center) < radiusM * 0.3) return;
    const ctrl = new AbortController();
    lastFetch.current = { center, radiusM };
    setLoading(true);
    setError(null);
    fetchPlaces(center, radiusM, {}, ctrl.signal)
      .then(setBasePlaces)
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        lastFetch.current = null;
        setError(e instanceof Error ? e.message : 'Mekanlar yüklenemedi');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [center?.latitude, center?.longitude, radiusM, reloadKey]);

  const places = useMemo(
    () =>
      basePlaces.map((p) => {
        const voted = (votes[p.id] ?? 0) > 0;
        if (!voted) return p;
        const motoScore = p.motoScore + 2;
        return { ...p, motoScore, motoFriendly: true };
      }),
    [basePlaces, votes],
  );

  return {
    places,
    loading,
    error,
    reload: () => {
      lastFetch.current = null;
      setReloadKey((k) => k + 1);
    },
  };
}
