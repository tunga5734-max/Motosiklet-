import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import type { LatLng } from '../types';

export function useUserLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      if (last && !cancelled) setLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 3000 },
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      );
      if (cancelled) sub.remove();
    })().catch(() => setDenied(true));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return { location, denied };
}
