/**
 * Üyelik katmanları ve özellik yetkileri.
 * Tüm özellik kontrolleri `can(tier, feature)` / `limits[tier]` üzerinden yapılır.
 */
export type Tier = 'free' | 'premium';

export type Feature =
  | 'motoEta' // motosiklet varış süresi
  | 'liveTraffic' // Google canlı trafik verisi
  | 'alternativeRoutes'
  | 'safeRoute'
  | 'curvyRoute'
  | 'riderProfile' // şerit arası seviye, emniyet şeridi ayarı
  | 'weatherEta' // hava durumuna göre ETA düzeltmesi
  | 'placeFiltersPro' // servis, park, 7/24 filtreleri
  | 'unlimitedFavorites';

const FEATURES: Record<Tier, Feature[]> = {
  free: ['motoEta'],
  premium: [
    'motoEta',
    'liveTraffic',
    'alternativeRoutes',
    'safeRoute',
    'curvyRoute',
    'riderProfile',
    'weatherEta',
    'placeFiltersPro',
    'unlimitedFavorites',
  ],
};

export const limits: Record<Tier, { placeRadiusM: number; favorites: number }> = {
  free: { placeRadiusM: 3000, favorites: 3 },
  premium: { placeRadiusM: 15000, favorites: Infinity },
};

export function can(tier: Tier, feature: Feature): boolean {
  return FEATURES[tier].includes(feature);
}

export interface Plan {
  id: 'moto_plus_monthly' | 'moto_plus_yearly';
  title: string;
  priceLabel: string;
  periodLabel: string;
  badge?: string;
}

/** Fiyatlar mağaza (App Store / Google Play) ürünlerinden gelmelidir; burada varsayılanlar. */
export const PLANS: Plan[] = [
  { id: 'moto_plus_monthly', title: 'Moto+ Aylık', priceLabel: '89,99 ₺', periodLabel: '/ay' },
  { id: 'moto_plus_yearly', title: 'Moto+ Yıllık', priceLabel: '699,99 ₺', periodLabel: '/yıl', badge: '%35 indirim' },
];

export interface ComparisonRow {
  label: string;
  free: string | boolean;
  premium: string | boolean;
}

export const COMPARISON: ComparisonRow[] = [
  { label: 'Türkiye geneli harita ve arama', free: true, premium: true },
  { label: 'Motosiklet varış süresi (araba ile karşılaştırma)', free: true, premium: true },
  { label: 'Trafik verisi', free: 'Tahmini', premium: 'Canlı' },
  { label: 'Benzinci ve moto dostu kafeler', free: '3 km', premium: '15 km' },
  { label: 'Moto servis, lastikçi, park, 7/24 filtreleri', free: false, premium: true },
  { label: 'Alternatif rotalar', free: false, premium: true },
  { label: 'Güvenli rota modu', free: false, premium: true },
  { label: 'Virajlı / keyif rotası', free: false, premium: true },
  { label: 'Sürüş profili (şerit arası seviye)', free: 'Standart', premium: 'Kişisel' },
  { label: 'Hava durumu etkili varış süresi', free: false, premium: true },
  { label: 'Rüzgar / yağmur güvenlik uyarıları', free: true, premium: true },
  { label: 'Favori yerler', free: '3', premium: 'Sınırsız' },
];
