import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { COMPARISON, PLANS, type Plan } from '../../src/subscription/plans';
import { purchaseService } from '../../src/subscription/purchases';
import { colors } from '../../src/theme';

export default function PremiumScreen() {
  const app = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const isPremium = app.tier === 'premium';

  const buy = async (plan: Plan) => {
    setBusy(plan.id);
    try {
      await app.purchase(plan.id);
      Alert.alert('Moto+ aktif', 'Tüm Moto+ özellikleri açıldı. İyi sürüşler!');
    } catch (e) {
      Alert.alert('Satın alma başarısız', e instanceof Error ? e.message : 'Lütfen tekrar deneyin.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <MaterialIcons name="workspace-premium" size={40} color="#fff" />
        <Text style={styles.heroTitle}>Moto+</Text>
        <Text style={styles.heroText}>
          Canlı trafikle motosiklete özel varış süresi, güvenli ve virajlı rotalar, kişisel sürüş profili.
        </Text>
        {isPremium ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeText}>
              Aktif üyelik
              {app.entitlement.expiresAt
                ? ` · ${new Date(app.entitlement.expiresAt).toLocaleDateString('tr-TR')} tarihine kadar`
                : ''}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.table}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.td, styles.feature, styles.thText]}>Özellik</Text>
          <Text style={[styles.td, styles.thText]}>Ücretsiz</Text>
          <Text style={[styles.td, styles.thText, { color: colors.premium }]}>Moto+</Text>
        </View>
        {COMPARISON.map((row) => (
          <View key={row.label} style={styles.tr}>
            <Text style={[styles.td, styles.feature]}>{row.label}</Text>
            <Cell v={row.free} />
            <Cell v={row.premium} premium />
          </View>
        ))}
      </View>

      {!isPremium
        ? PLANS.map((p) => (
            <Pressable key={p.id} style={styles.plan} onPress={() => buy(p)} disabled={!!busy}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{p.title}</Text>
                {p.badge ? <Text style={styles.planBadge}>{p.badge}</Text> : null}
              </View>
              {busy === p.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.planPrice}>
                  {p.priceLabel}
                  <Text style={styles.planPeriod}>{p.periodLabel}</Text>
                </Text>
              )}
            </Pressable>
          ))
        : null}

      <Pressable onPress={() => app.restore()} style={styles.link}>
        <Text style={styles.linkText}>Satın alımları geri yükle</Text>
      </Pressable>
      {isPremium && purchaseService.isSimulated ? (
        <Pressable onPress={() => app.cancelSubscription()} style={styles.link}>
          <Text style={[styles.linkText, { color: colors.jam }]}>Üyeliği iptal et (test)</Text>
        </Pressable>
      ) : null}
      {purchaseService.isSimulated ? (
        <Text style={styles.note}>
          Geliştirme sürümü: satın alma simüle edilir, ücret alınmaz. Mağaza sürümünde App Store / Google Play
          aboneliği kullanılır.
        </Text>
      ) : null}
      <Text style={styles.note}>
        Abonelik, dönem bitiminden en az 24 saat önce iptal edilmezse otomatik yenilenir. İptal işlemi mağaza hesap
        ayarlarından yapılır.
      </Text>
    </ScrollView>
  );
}

function Cell({ v, premium }: { v: string | boolean; premium?: boolean }) {
  if (typeof v === 'boolean') {
    return (
      <View style={[styles.td, { alignItems: 'center' }]}>
        <MaterialIcons
          name={v ? 'check-circle' : 'remove'}
          size={18}
          color={v ? (premium ? colors.premium : colors.free) : colors.border}
        />
      </View>
    );
  }
  return <Text style={[styles.td, styles.cellText, premium && { color: colors.premium, fontWeight: '700' }]}>{v}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { backgroundColor: colors.premium, borderRadius: 18, padding: 20, alignItems: 'center', gap: 6 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  heroText: { color: '#EDE3FF', textAlign: 'center', fontSize: 14 },
  activeBadge: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 6 },
  activeText: { color: colors.premium, fontWeight: '700', fontSize: 12 },
  table: { marginTop: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  th: { backgroundColor: colors.surface },
  thText: { fontWeight: '700', textAlign: 'center' },
  td: { flex: 1, padding: 10 },
  feature: { flex: 2.2, fontSize: 13, color: colors.text, textAlign: 'left' },
  cellText: { textAlign: 'center', fontSize: 12, color: colors.text },
  plan: {
    marginTop: 12,
    backgroundColor: colors.text,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  planTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  planBadge: { color: '#7CE0A3', fontSize: 12, fontWeight: '700', marginTop: 2 },
  planPrice: { color: '#fff', fontSize: 18, fontWeight: '800' },
  planPeriod: { fontSize: 13, fontWeight: '400' },
  link: { alignItems: 'center', marginTop: 14 },
  linkText: { color: colors.premium, fontWeight: '600' },
  note: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 10 },
});
