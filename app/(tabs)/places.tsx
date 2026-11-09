import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { showUpsell } from '../../src/components/upsell';
import { useUserLocation } from '../../src/hooks/useLocation';
import { usePlaces } from '../../src/hooks/usePlaces';
import { useApp } from '../../src/state/AppContext';
import { limits } from '../../src/subscription/plans';
import { categoryMeta, colors } from '../../src/theme';
import type { Place, PlaceCategory } from '../../src/types';
import { formatDistance } from '../../src/utils/format';

type Filter = 'all' | PlaceCategory;

export default function PlacesScreen() {
  const app = useApp();
  const { location, denied } = useUserLocation();
  const radius = limits[app.tier].placeRadiusM;
  const { places, loading, error, reload } = usePlaces(location, radius, app.votes);
  const [filter, setFilter] = useState<Filter>('all');
  const [friendlyOnly, setFriendlyOnly] = useState(false);
  const [open24, setOpen24] = useState(false);
  const pro = app.can('placeFiltersPro');

  const list = useMemo(
    () =>
      places.filter((p) => {
        if (!pro && (p.category === 'service' || p.category === 'parking')) return false;
        if (filter !== 'all' && p.category !== filter) return false;
        if (friendlyOnly && !p.motoFriendly) return false;
        if (open24 && !p.open24h) return false;
        return true;
      }),
    [places, filter, friendlyOnly, open24, pro],
  );

  const chips: { id: Filter; label: string; locked?: boolean }[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'fuel', label: categoryMeta.fuel.label },
    { id: 'cafe', label: categoryMeta.cafe.label },
    { id: 'service', label: categoryMeta.service.label, locked: !pro },
    { id: 'parking', label: categoryMeta.parking.label, locked: !pro },
  ];

  const goTo = (p: Place) => {
    app.setPendingDestination({ name: p.name, location: p.location });
    router.navigate('/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        {chips.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, filter === c.id && styles.chipActive]}
            onPress={() => (c.locked ? showUpsell(`${c.label} filtresi`) : setFilter(c.id))}
          >
            <Text style={[styles.chipText, filter === c.id && { color: '#fff' }]}>{c.label}</Text>
            {c.locked ? <MaterialIcons name="lock" size={12} color={colors.premium} /> : null}
          </Pressable>
        ))}
        <Pressable style={[styles.chip, friendlyOnly && styles.chipActive]} onPress={() => setFriendlyOnly((v) => !v)}>
          <MaterialIcons name="two-wheeler" size={14} color={friendlyOnly ? '#fff' : colors.text} />
          <Text style={[styles.chipText, friendlyOnly && { color: '#fff' }]}>Moto dostu</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, open24 && styles.chipActive]}
          onPress={() => (pro ? setOpen24((v) => !v) : showUpsell('7/24 açık filtresi'))}
        >
          <Text style={[styles.chipText, open24 && { color: '#fff' }]}>7/24</Text>
          {!pro ? <MaterialIcons name="lock" size={12} color={colors.premium} /> : null}
        </Pressable>
      </View>
      <Text style={styles.info}>
        {formatDistance(radius)} çevrenizde · Veri: OpenStreetMap
        {!pro ? ' · Moto+ ile 15 km' : ''}
      </Text>

      {!location ? (
        <Text style={styles.empty}>{denied ? 'Yakındaki yerler için konum izni verin.' : 'Konum alınıyor…'}</Text>
      ) : loading && places.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : error ? (
        <Pressable onPress={reload}>
          <Text style={styles.empty}>{error}. Tekrar denemek için dokunun.</Text>
        </Pressable>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(p) => p.id}
          onRefresh={reload}
          refreshing={loading}
          ListEmptyComponent={<Text style={styles.empty}>Bu filtreyle sonuç bulunamadı.</Text>}
          renderItem={({ item }) => (
            <PlaceRow place={item} voted={!!app.votes[item.id]} onVote={() => app.toggleVote(item.id)} onGo={() => goTo(item)} />
          )}
        />
      )}
    </View>
  );
}

function PlaceRow({ place, voted, onVote, onGo }: { place: Place; voted: boolean; onVote: () => void; onGo: () => void }) {
  const meta = categoryMeta[place.category];
  const brand = place.tags.brand && place.tags.brand !== place.name ? place.tags.brand : null;
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: meta.color }]}>
        <MaterialIcons name={meta.icon} size={20} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {meta.label}
          {brand ? ` · ${brand}` : ''} · {formatDistance(place.distanceM ?? 0)}
          {place.open24h ? ' · 7/24' : ''}
        </Text>
        {place.motoFriendly ? (
          <View style={styles.badge}>
            <MaterialIcons name="two-wheeler" size={12} color={colors.primary} />
            <Text style={styles.badgeText}>Moto dostu</Text>
          </View>
        ) : null}
      </View>
      {place.category !== 'parking' ? (
        <Pressable onPress={onVote} hitSlop={8} style={styles.action} accessibilityLabel="Moto dostu olarak işaretle">
          <MaterialIcons name={voted ? 'thumb-up' : 'thumb-up-off-alt'} size={22} color={voted ? colors.primary : colors.muted} />
        </Pressable>
      ) : null}
      <Pressable onPress={onGo} hitSlop={8} style={styles.action} accessibilityLabel="Yol tarifi">
        <MaterialIcons name="directions" size={26} color={colors.fuel} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12, paddingBottom: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  info: { fontSize: 12, color: colors.muted, paddingHorizontal: 14, paddingBottom: 8 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  badgeText: { fontSize: 11, color: colors.primary, fontWeight: '700' },
  action: { padding: 4 },
});
