import { MaterialIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoutePanel } from '../../src/components/RoutePanel';
import { SearchBar } from '../../src/components/SearchBar';
import { showUpsell } from '../../src/components/upsell';
import { useUserLocation } from '../../src/hooks/useLocation';
import { usePlaces } from '../../src/hooks/usePlaces';
import { navProgress, type NavProgress } from '../../src/services/navigation';
import { planRoutes } from '../../src/services/routing';
import { basicConditions, fetchWeather, type Weather } from '../../src/services/weather';
import { useApp, type Destination } from '../../src/state/AppContext';
import { limits } from '../../src/subscription/plans';
import { categoryMeta, colors, congestionColor } from '../../src/theme';
import type { CongestionLevel, LatLng, MotoRoute, PlaceCategory, RouteMode } from '../../src/types';
import { formatArrival, formatDistance, formatDuration } from '../../src/utils/format';
import { regionForCoords, TURKEY_REGION } from '../../src/utils/geo';

const PLACE_ZOOM_DELTA = 0.35; // bu yakınlaştırmadan sonra mekanlar yüklenir
const REROUTE_OFF_M = 120;

export default function MapScreen() {
  const app = useApp();
  const mapRef = useRef<MapView>(null);
  const { location, denied } = useUserLocation();

  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<Destination | null>(null);
  const [mode, setMode] = useState<RouteMode>('fastest');
  const [routes, setRoutes] = useState<MotoRoute[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>();
  const [providerName, setProviderName] = useState<string | undefined>();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState<NavProgress | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng | null>(null);
  const [layers, setLayers] = useState<Record<PlaceCategory, boolean>>({
    fuel: true,
    cafe: true,
    service: false,
    parking: false,
  });
  const lastReroute = useRef(0);
  const centeredOnUser = useRef(false);

  // İlk konum alındığında haritayı kullanıcıya odakla
  useEffect(() => {
    if (location && !centeredOnUser.current) {
      centeredOnUser.current = true;
      mapRef.current?.animateToRegion({ ...location, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 600);
      setMapCenter(location);
    }
  }, [location]);

  // Mekanlar sekmesinden gelen hedef
  useEffect(() => {
    if (app.pendingDestination) {
      setDestination(app.pendingDestination);
      setQuery(app.pendingDestination.name);
      app.setPendingDestination(null);
    }
  }, [app.pendingDestination]);

  // Hava durumu (konum ~ her 10 dk)
  useEffect(() => {
    if (!location) return;
    const ctrl = new AbortController();
    fetchWeather(location, ctrl.signal).then(setWeather).catch(() => {});
    return () => ctrl.abort();
  }, [location ? Math.round(location.latitude * 20) : null, location ? Math.round(location.longitude * 20) : null]);

  const plan = useCallback(
    async (origin: LatLng, dest: Destination, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const realConditions = weather ?? basicConditions();
        const etaConditions = app.can('weatherEta') ? realConditions : basicConditions();
        const res = await planRoutes(
          { origin, destination: dest.location },
          {
            profile: app.effectiveProfile,
            conditions: etaConditions,
            safetyConditions: realConditions,
            mode,
            liveTraffic: app.can('liveTraffic'),
            alternatives: app.can('alternativeRoutes'),
            avoidTolls: false,
          },
          signal,
        );
        if (signal?.aborted) return;
        setRoutes(res.routes);
        setSelected(0);
        setNotice(res.notice);
        setProviderName(res.providerName);
        if (res.routes[0] && !navigating) {
          mapRef.current?.animateToRegion(regionForCoords(res.routes[0].route.polyline, 1.5), 700);
        }
      } catch (e) {
        if (signal?.aborted) return;
        setRoutes([]);
        setError(e instanceof Error ? e.message : 'Rota hesaplanamadı');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [app.effectiveProfile, app.tier, mode, weather, navigating],
  );

  // Hedef / mod / profil / üyelik değişince yeniden hesapla
  useEffect(() => {
    if (!destination) return;
    if (!location) {
      setError(denied ? 'Rota için konum izni gerekli. Ayarlardan izin verin.' : 'Konum bekleniyor…');
      return;
    }
    const ctrl = new AbortController();
    plan(location, destination, ctrl.signal);
    return () => ctrl.abort();
    // konum değişimleri sürüş sırasında aşağıdaki efektte ele alınır
  }, [destination, mode, app.effectiveProfile, app.tier, location == null]);

  // Sürüş modu: ilerleme, kamera takibi, rotadan çıkınca yeniden hesaplama
  const current = routes[selected];
  useEffect(() => {
    if (!navigating || !location || !current) return;
    const p = navProgress(current, location);
    setProgress(p);
    mapRef.current?.animateCamera({ center: location, zoom: 17, pitch: 45 }, { duration: 500 });
    if (p.arrived) {
      setNavigating(false);
      Alert.alert('Varış', `${destination?.name ?? 'Hedef'} noktasına ulaştınız. İyi sürüşler!`);
      return;
    }
    if (p.offRouteM > REROUTE_OFF_M && destination && Date.now() - lastReroute.current > 20_000) {
      lastReroute.current = Date.now();
      plan(location, destination);
    }
  }, [location, navigating, current]);

  // Mekanlar (harita merkezi etrafında)
  const radius = limits[app.tier].placeRadiusM;
  const { places } = usePlaces(mapCenter, radius, app.votes);
  const visiblePlaces = useMemo(
    () =>
      places.filter((p) => {
        if (!layers[p.category]) return false;
        if (p.category === 'cafe') return p.motoFriendly; // haritada yalnız moto dostu kafeler
        return true;
      }),
    [places, layers],
  );

  const onRegionChangeComplete = (r: Region) => {
    if (r.latitudeDelta < PLACE_ZOOM_DELTA) setMapCenter({ latitude: r.latitude, longitude: r.longitude });
  };

  const toggleLayer = (c: PlaceCategory) => {
    if ((c === 'service' || c === 'parking') && !app.can('placeFiltersPro')) {
      showUpsell('Moto servis ve park katmanları');
      return;
    }
    setLayers((l) => ({ ...l, [c]: !l[c] }));
  };

  const changeMode = (m: RouteMode) => {
    if (m === 'safe' && !app.can('safeRoute')) return showUpsell('Güvenli rota modu');
    if (m === 'curvy' && !app.can('curvyRoute')) return showUpsell('Virajlı / keyif rotası');
    setMode(m);
  };

  const closeRoute = () => {
    setDestination(null);
    setRoutes([]);
    setError(null);
    setQuery('');
    setNavigating(false);
    setProgress(null);
  };

  const destFavId = destination
    ? `${destination.location.latitude.toFixed(5)},${destination.location.longitude.toFixed(5)}`
    : '';
  const isFavorite = app.favorites.some((f) => f.id === destFavId);
  const toggleFavorite = () => {
    if (!destination) return;
    if (isFavorite) return app.removeFavorite(destFavId);
    if (!app.addFavorite({ id: destFavId, name: destination.name, location: destination.location })) {
      showUpsell(`${limits.free.favorites}'ten fazla favori`);
    }
  };

  // Seçili rotayı tıkanıklık rengine göre birleşik çizgilere ayır
  const coloredLines = useMemo(() => {
    if (!current) return [];
    const lines: { color: CongestionLevel; coords: LatLng[] }[] = [];
    for (const s of current.segments) {
      const last = lines[lines.length - 1];
      if (last && last.color === s.congestion) last.coords.push(...s.coords.slice(1));
      else lines.push({ color: s.congestion, coords: [...s.coords] });
    }
    return lines;
  }, [current]);

  const weatherLabel = weather
    ? `${Math.round(weather.temperatureC)}°C${weather.rain ? ' · yağmur' : ''} · rüzgar ${Math.round(weather.windKmh ?? 0)} km/s`
    : undefined;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={TURKEY_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsTraffic={false}
        showsCompass
        rotateEnabled
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={(e) => {
          if (navigating) return;
          const c = e.nativeEvent.coordinate;
          setDestination({ name: 'Seçilen nokta', location: c });
          setQuery('Seçilen nokta');
        }}
      >
        {routes.map((r, i) =>
          i === selected ? null : (
            <Polyline
              key={r.route.id}
              coordinates={r.route.polyline}
              strokeColor="#9AA4B2"
              strokeWidth={5}
              tappable
              onPress={() => setSelected(i)}
            />
          ),
        )}
        {current ? (
          <Polyline coordinates={current.route.polyline} strokeColor={colors.primaryDark} strokeWidth={10} zIndex={1} />
        ) : null}
        {coloredLines.map((l, i) => (
          <Polyline key={`c${i}`} coordinates={l.coords} strokeColor={congestionColor[l.color]} strokeWidth={6} zIndex={2} />
        ))}
        {destination ? <Marker coordinate={destination.location} title={destination.name} pinColor={colors.primary} /> : null}
        {visiblePlaces.map((p) => (
          <Marker
            key={p.id}
            coordinate={p.location}
            title={p.name}
            description={`${categoryMeta[p.category].label}${p.motoFriendly ? ' · Moto dostu' : ''}${p.open24h ? ' · 7/24' : ''}`}
            tracksViewChanges={false}
            onCalloutPress={() => {
              if (navigating) return;
              setDestination({ name: p.name, location: p.location });
              setQuery(p.name);
            }}
          >
            <View style={[styles.poi, { backgroundColor: categoryMeta[p.category].color }, p.motoFriendly && styles.poiFriendly]}>
              <MaterialIcons name={categoryMeta[p.category].icon} size={14} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
        {navigating && progress ? (
          <View style={styles.navBanner}>
            <MaterialIcons name="turn-right" size={30} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.navDist}>{formatDistance(progress.distanceToNextStepM)}</Text>
              <Text style={styles.navText} numberOfLines={2}>
                {progress.nextStep?.instruction ?? 'Hedefe doğru devam edin'}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              near={location}
              favorites={app.favorites}
              onSelect={(r) => {
                setQuery(r.name);
                setDestination({ name: r.name, location: r.location });
              }}
            />
            <View style={styles.layers}>
              {(Object.keys(categoryMeta) as PlaceCategory[]).map((c) => {
                const locked = (c === 'service' || c === 'parking') && !app.can('placeFiltersPro');
                return (
                  <Pressable
                    key={c}
                    onPress={() => toggleLayer(c)}
                    style={[styles.layerChip, layers[c] && !locked && { backgroundColor: categoryMeta[c].color }]}
                  >
                    <MaterialIcons name={categoryMeta[c].icon} size={14} color={layers[c] && !locked ? '#fff' : colors.text} />
                    <Text style={[styles.layerText, layers[c] && !locked && { color: '#fff' }]}>{categoryMeta[c].label}</Text>
                    {locked ? <MaterialIcons name="lock" size={12} color={colors.premium} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </SafeAreaView>

      <Pressable
        style={[styles.locBtn, { bottom: destination ? 440 : 30 }]}
        onPress={() =>
          location
            ? mapRef.current?.animateToRegion({ ...location, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 500)
            : Alert.alert('Konum', denied ? 'Konum izni verilmedi.' : 'Konum alınıyor…')
        }
      >
        <MaterialIcons name="my-location" size={24} color={colors.text} />
      </Pressable>

      {navigating && progress ? (
        <View style={styles.navBottom}>
          <View>
            <Text style={styles.navEta}>{formatDuration(progress.remainingMotoS)}</Text>
            <Text style={styles.navSub}>
              {formatDistance(progress.remainingM)} · Varış {formatArrival(progress.remainingMotoS)}
            </Text>
          </View>
          <Pressable
            style={styles.stopBtn}
            onPress={() => {
              setNavigating(false);
              if (current) mapRef.current?.animateToRegion(regionForCoords(current.route.polyline, 1.5), 500);
            }}
          >
            <Text style={styles.stopText}>Bitir</Text>
          </Pressable>
        </View>
      ) : destination ? (
        <View style={styles.bottom}>
          <RoutePanel
            destinationName={destination.name}
            routes={routes}
            selected={selected}
            onSelect={setSelected}
            mode={mode}
            onModeChange={changeMode}
            lockedModes={[
              ...(app.can('safeRoute') ? [] : (['safe'] as RouteMode[])),
              ...(app.can('curvyRoute') ? [] : (['curvy'] as RouteMode[])),
            ]}
            loading={loading}
            error={error}
            notice={notice}
            providerName={providerName}
            weatherLabel={weatherLabel}
            onStart={() => {
              if (!location) return Alert.alert('Konum', 'Sürüş için konum gerekli.');
              setNavigating(true);
            }}
            onClose={closeRoute}
            onFavorite={toggleFavorite}
            isFavorite={isFavorite}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 8 },
  layers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 12, marginTop: 8 },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  layerText: { fontSize: 12, fontWeight: '600', color: colors.text },
  poi: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  poiFriendly: { borderColor: colors.primary, borderWidth: 3 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  locBtn: {
    position: 'absolute',
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  navBanner: {
    marginHorizontal: 12,
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navDist: { color: '#fff', fontSize: 22, fontWeight: '800' },
  navText: { color: '#fff', fontSize: 15 },
  navBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    padding: 18,
    paddingBottom: 26,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 12,
  },
  navEta: { fontSize: 26, fontWeight: '800', color: colors.primary },
  navSub: { color: colors.muted },
  stopBtn: { backgroundColor: colors.jam, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  stopText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
