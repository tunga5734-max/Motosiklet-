import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { showUpsell } from '../../src/components/upsell';
import { hasLiveTraffic } from '../../src/config';
import { useApp } from '../../src/state/AppContext';
import { limits } from '../../src/subscription/plans';
import { colors } from '../../src/theme';
import type { FilteringLevel } from '../../src/types';

const FILTERING: { id: FilteringLevel; label: string; desc: string }[] = [
  { id: 'none', label: 'Hiç', desc: 'Trafikte araç gibi beklerim' },
  { id: 'cautious', label: 'Temkinli', desc: 'Yalnızca duran trafikte, yavaşça' },
  { id: 'normal', label: 'Normal', desc: 'Yoğun trafikte şerit arasından ilerlerim' },
  { id: 'experienced', label: 'Deneyimli', desc: 'Şehir içinde akıcı şerit arası sürüş' },
];

const ENGINES = [
  { cc: 50, label: '≤50cc (moped)' },
  { cc: 125, label: '125cc' },
  { cc: 250, label: '250-500cc' },
  { cc: 750, label: '500cc+' },
];

export default function ProfileScreen() {
  const app = useApp();
  const pro = app.can('riderProfile');
  const p = app.profile;

  const setFiltering = (f: FilteringLevel) => {
    if (!pro) return showUpsell('Kişisel şerit arası sürüş seviyesi');
    app.setProfile({ ...p, filtering: f });
  };

  const setShoulder = (v: boolean) => {
    if (!pro) return showUpsell('Sürüş profili ayarları');
    if (v) {
      Alert.alert(
        'Emniyet şeridi',
        'Karayolları Trafik Kanunu’na göre emniyet şeridinin acil durum dışında kullanılması yasaktır ve para cezası uygulanır. Bu ayar yalnızca süre tahminini etkiler; kurallara uymak sürücünün sorumluluğundadır.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Anladım, aç', onPress: () => app.setProfile({ ...p, useShoulder: true }) },
        ],
      );
    } else app.setProfile({ ...p, useShoulder: false });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Pressable style={[styles.tierCard, app.tier === 'premium' && { backgroundColor: colors.premium }]} onPress={() => router.push('/premium')}>
        <MaterialIcons name={app.tier === 'premium' ? 'workspace-premium' : 'person'} size={28} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.tierTitle}>{app.tier === 'premium' ? 'Moto+ üyesi' : 'Ücretsiz üyelik'}</Text>
          <Text style={styles.tierSub}>{app.tier === 'premium' ? 'Tüm özellikler açık' : "Moto+'a geçerek tüm özellikleri açın"}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#fff" />
      </Pressable>

      <Text style={styles.section}>Motosikletim</Text>
      <View style={styles.options}>
        {ENGINES.map((e) => (
          <Pressable
            key={e.cc}
            style={[styles.opt, p.engineCc === e.cc && styles.optActive]}
            onPress={() => app.setProfile({ ...p, engineCc: e.cc })}
          >
            <Text style={[styles.optText, p.engineCc === e.cc && { color: '#fff' }]}>{e.label}</Text>
          </Pressable>
        ))}
      </View>
      {p.engineCc <= 50 ? <Text style={styles.hint}>Mopedler otoyola giremez; rotalar otoyolsuz hesaplanır.</Text> : null}

      <Text style={styles.section}>
        Şerit arası sürüş {!pro ? <MaterialIcons name="lock" size={14} color={colors.premium} /> : null}
      </Text>
      {FILTERING.map((f) => {
        const active = (pro ? p.filtering : app.effectiveProfile.filtering) === f.id;
        return (
          <Pressable key={f.id} style={[styles.radio, active && styles.radioActive]} onPress={() => setFiltering(f.id)}>
            <MaterialIcons name={active ? 'radio-button-checked' : 'radio-button-unchecked'} size={22} color={active ? colors.primary : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.radioTitle}>{f.label}</Text>
              <Text style={styles.radioDesc}>{f.desc}</Text>
            </View>
          </Pressable>
        );
      })}
      {!pro ? <Text style={styles.hint}>Ücretsiz üyelikte “Normal” profil kullanılır.</Text> : null}

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.radioTitle}>Emniyet şeridini hesaba kat</Text>
          <Text style={styles.radioDesc}>Yasal değildir; varsayılan kapalı.</Text>
        </View>
        <Switch value={pro && p.useShoulder} onValueChange={setShoulder} trackColor={{ true: colors.primary }} />
      </View>

      <Text style={styles.section}>
        Favoriler ({app.favorites.length}/{Number.isFinite(limits[app.tier].favorites) ? limits[app.tier].favorites : '∞'})
      </Text>
      {app.favorites.length === 0 ? <Text style={styles.hint}>Rota ekranındaki ☆ ile favori ekleyin.</Text> : null}
      {app.favorites.map((f) => (
        <View key={f.id} style={styles.fav}>
          <MaterialIcons name="star" size={20} color={colors.primary} />
          <Pressable
            style={{ flex: 1 }}
            onPress={() => {
              app.setPendingDestination({ name: f.name, location: f.location });
              router.navigate('/');
            }}
          >
            <Text style={styles.radioTitle} numberOfLines={1}>{f.name}</Text>
          </Pressable>
          <Pressable onPress={() => app.removeFavorite(f.id)} hitSlop={8}>
            <MaterialIcons name="delete-outline" size={22} color={colors.muted} />
          </Pressable>
        </View>
      ))}

      <Text style={styles.section}>Veri kaynakları</Text>
      <Text style={styles.hint}>
        Harita ve mekanlar: OpenStreetMap katkıcıları (Türkiye geneli, sürekli güncel).{'\n'}
        Trafik: {hasLiveTraffic() ? 'Google canlı trafik (Moto+) / tahmini model' : 'tahmini trafik modeli (canlı trafik anahtarı tanımlı değil)'}.{'\n'}
        Hava durumu: Open-Meteo.
      </Text>
      <Text style={styles.disclaimer}>
        Motor süresi tahminidir. Trafik kurallarına uyun, şerit arası sürüşte hızınızı düşük tutun ve koruyucu
        ekipman kullanın.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tierCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.text, borderRadius: 16, padding: 16 },
  tierTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  tierSub: { color: '#D0D4DA', fontSize: 12 },
  section: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 22, marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.surface },
  optActive: { backgroundColor: colors.primary },
  optText: { fontWeight: '600', color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 18 },
  radio: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, marginBottom: 4 },
  radioActive: { backgroundColor: '#FFF1E8' },
  radioTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  radioDesc: { fontSize: 12, color: colors.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 10 },
  fav: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  disclaimer: { fontSize: 11, color: colors.muted, marginTop: 18, fontStyle: 'italic' },
});
