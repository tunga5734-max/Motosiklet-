import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import type { MotoRoute, RouteMode } from '../types';
import { formatArrival, formatDistance, formatDuration } from '../utils/format';

interface Props {
  destinationName: string;
  routes: MotoRoute[];
  selected: number;
  onSelect: (i: number) => void;
  mode: RouteMode;
  onModeChange: (m: RouteMode) => void;
  lockedModes: RouteMode[];
  loading: boolean;
  error: string | null;
  notice?: string;
  providerName?: string;
  weatherLabel?: string;
  onStart: () => void;
  onClose: () => void;
  onFavorite: () => void;
  isFavorite: boolean;
}

const MODES: { id: RouteMode; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { id: 'fastest', label: 'En hızlı', icon: 'bolt' },
  { id: 'safe', label: 'Güvenli', icon: 'shield' },
  { id: 'curvy', label: 'Virajlı', icon: 'gesture' },
];

export function RoutePanel(p: Props) {
  const [showSteps, setShowSteps] = useState(false);
  const r = p.routes[p.selected];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.dest} numberOfLines={1}>{p.destinationName}</Text>
        <Pressable onPress={p.onFavorite} hitSlop={10}>
          <MaterialIcons name={p.isFavorite ? 'star' : 'star-border'} size={24} color={colors.primary} />
        </Pressable>
        <Pressable onPress={p.onClose} hitSlop={10}>
          <MaterialIcons name="close" size={24} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.modes}>
        {MODES.map((m) => {
          const locked = p.lockedModes.includes(m.id);
          const active = p.mode === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => p.onModeChange(m.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <MaterialIcons name={m.icon} size={16} color={active ? '#fff' : colors.text} />
              <Text style={[styles.chipText, active && { color: '#fff' }]}>{m.label}</Text>
              {locked ? <MaterialIcons name="lock" size={13} color={colors.premium} /> : null}
            </Pressable>
          );
        })}
      </View>

      {p.loading ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} size="large" />
      ) : p.error ? (
        <Text style={styles.error}>{p.error}</Text>
      ) : r ? (
        <ScrollView style={{ maxHeight: 360 }}>
          <View style={styles.compare}>
            <View style={styles.motoBox}>
              <MaterialIcons name="two-wheeler" size={26} color="#fff" />
              <Text style={styles.motoTime}>{formatDuration(r.motoS)}</Text>
              <Text style={styles.motoSub}>Varış {formatArrival(r.motoS)}</Text>
            </View>
            <View style={styles.carBox}>
              <View style={styles.row}>
                <MaterialIcons name="directions-car" size={18} color={colors.car} />
                <Text style={styles.carTime}>{formatDuration(r.carS)}</Text>
              </View>
              {r.savedS >= 60 ? (
                <Text style={styles.saved}>Motorla {formatDuration(r.savedS)} daha hızlı</Text>
              ) : (
                <Text style={styles.carSub}>Trafik akıcı, fark yok</Text>
              )}
              <Text style={styles.carSub}>{formatDistance(r.route.distanceM)}</Text>
            </View>
          </View>

          <CongestionBar route={r} />

          <View style={styles.metaRow}>
            <Meta icon="shield" label={`Güvenlik ${r.safety.score}/100`} />
            <Meta
              icon={r.route.trafficSource === 'live' ? 'sensors' : 'schedule'}
              label={r.route.trafficSource === 'live' ? 'Canlı trafik' : 'Tahmini trafik'}
            />
            {p.weatherLabel ? <Meta icon="cloud" label={p.weatherLabel} /> : null}
          </View>
          {p.notice ? <Text style={styles.notice}>{p.notice}</Text> : null}
          {r.safety.warnings.map((w) => (
            <View key={w} style={styles.warn}>
              <MaterialIcons name="warning-amber" size={16} color={colors.slow} />
              <Text style={styles.warnText}>{w}</Text>
            </View>
          ))}

          {p.routes.length > 1 ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.section}>Alternatifler</Text>
              {p.routes.map((alt, i) => (
                <Pressable
                  key={alt.route.id}
                  onPress={() => p.onSelect(i)}
                  style={[styles.alt, i === p.selected && styles.altActive]}
                >
                  <Text style={styles.altTitle} numberOfLines={1}>{alt.route.summary}</Text>
                  <Text style={styles.altInfo}>
                    🏍 {formatDuration(alt.motoS)} · 🚗 {formatDuration(alt.carS)} · 🛡 {alt.safety.score}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable onPress={() => setShowSteps((s) => !s)} style={styles.stepsToggle}>
            <Text style={styles.section}>Yol tarifi ({r.route.steps.length} adım)</Text>
            <MaterialIcons name={showSteps ? 'expand-less' : 'expand-more'} size={22} color={colors.text} />
          </Pressable>
          {showSteps
            ? r.route.steps.map((s, i) => (
                <View key={i} style={styles.step}>
                  <Text style={styles.stepText}>{s.instruction}</Text>
                  <Text style={styles.stepDist}>{s.distanceM > 0 ? formatDistance(s.distanceM) : ''}</Text>
                </View>
              ))
            : null}
          {p.providerName ? <Text style={styles.provider}>Rota verisi: {p.providerName}</Text> : null}
        </ScrollView>
      ) : null}

      {r && !p.loading ? (
        <Pressable style={styles.start} onPress={p.onStart}>
          <MaterialIcons name="navigation" size={20} color="#fff" />
          <Text style={styles.startText}>Sürüşü başlat</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Meta({ icon, label }: { icon: keyof typeof MaterialIcons.glyphMap; label: string }) {
  return (
    <View style={styles.meta}>
      <MaterialIcons name={icon} size={14} color={colors.muted} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function CongestionBar({ route }: { route: MotoRoute }) {
  const total = route.route.distanceM || 1;
  return (
    <View>
      <View style={styles.bar}>
        {route.segments.map((s, i) => (
          <View
            key={i}
            style={{
              flex: s.distanceM / total,
              backgroundColor: s.congestion === 'jam' ? colors.jam : s.congestion === 'slow' ? colors.slow : colors.free,
            }}
          />
        ))}
      </View>
      <Text style={styles.barLegend}>Araç trafiği: yeşil akıcı · sarı yavaş · kırmızı yoğun (motor şerit arasından geçer)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  dest: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text },
  modes: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  compare: { flexDirection: 'row', gap: 10 },
  motoBox: { flex: 1.1, backgroundColor: colors.primary, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  motoTime: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 2 },
  motoSub: { color: '#FFE3D1', fontSize: 13 },
  carBox: { flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 12, justifyContent: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  carTime: { fontSize: 18, fontWeight: '700', color: colors.car, textDecorationLine: 'line-through' },
  saved: { color: colors.free, fontWeight: '700', fontSize: 13 },
  carSub: { color: colors.muted, fontSize: 12 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
  barLegend: { fontSize: 11, color: colors.muted, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.muted },
  notice: { marginTop: 8, fontSize: 12, color: colors.premium },
  warn: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'flex-start' },
  warnText: { flex: 1, fontSize: 12, color: colors.text },
  section: { fontSize: 14, fontWeight: '700', color: colors.text },
  alt: { padding: 10, borderRadius: 10, backgroundColor: colors.surface, marginTop: 6 },
  altActive: { borderWidth: 2, borderColor: colors.primary },
  altTitle: { fontWeight: '600', color: colors.text },
  altInfo: { fontSize: 12, color: colors.muted, marginTop: 2 },
  stepsToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  step: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  stepText: { flex: 1, fontSize: 13, color: colors.text },
  stepDist: { fontSize: 12, color: colors.muted, marginLeft: 8 },
  provider: { fontSize: 11, color: colors.muted, marginTop: 10 },
  error: { color: colors.jam, marginVertical: 16 },
  start: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
    borderRadius: 14,
    paddingVertical: 14,
  },
  startText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
