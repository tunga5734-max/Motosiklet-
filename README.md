# MotoRota 🏍️

Motosikletçiler için Türkiye geneli harita ve navigasyon uygulaması (iOS + Android, Expo / React Native).

Haritalar arabaya göre süre verir. Motosiklet ise yoğun trafikte araçların arasından ilerlediği için
aynı yolu çok daha kısa sürede gider. MotoRota, araç trafiğini alıp **motosiklete göre optimize edilmiş
varış süresi** hesaplar. Örneğin arabayla 1 saat görünen bir rota motorla yaklaşık 35 dakika çıkabilir.

## Özellikler

| Özellik | Ücretsiz | Moto+ |
|---|:---:|:---:|
| Türkiye geneli harita, adres/yer arama | ✅ | ✅ |
| Motosiklet varış süresi (araba ile karşılaştırma) | ✅ | ✅ |
| Trafik verisi | Tahmini model | **Canlı (Google)** |
| Benzinci ve moto dostu kafeler | 3 km | 15 km |
| Moto servis / lastikçi / moto park, 7/24 filtresi | – | ✅ |
| Alternatif rotalar | – | ✅ |
| Güvenli rota modu | – | ✅ |
| Virajlı / keyif rotası | – | ✅ |
| Sürüş profili (şerit arası sürüş seviyesi) | Standart | Kişisel |
| Hava durumuna göre varış süresi | – | ✅ |
| Rüzgar / yağmur güvenlik uyarıları | ✅ | ✅ |
| Favori yerler | 3 | Sınırsız |
| Sürüş modu (adım adım yönlendirme, rotadan çıkınca yeniden hesaplama) | ✅ | ✅ |

Özellik yetkileri tek yerde tanımlı: `src/subscription/plans.ts`.

## Motosiklet varış süresi nasıl hesaplanıyor?

`src/services/motoEta.ts`

1. Rota sağlayıcısı (Google veya OSRM) rotayı ~400-500 m'lik parçalara böler. Her parça için
   **serbest akış süresi** (trafik yokken) ve **araba için trafikli süre** bilinir.
2. `gecikme = trafikli − serbest`. Araba gecikmenin tamamını yaşar.
3. Motor bu gecikmenin bir kısmından kurtulur:
   `e = tıkanıklık × yol tipi × sürücü profili × hava`, en fazla %85.
   - Tıkanıklık: akıcı 0, yavaş 0.50, yoğun 0.72
   - Yol tipi: otoyol 1.0 … şehir içi 0.7 (kırmızı ışık aşılamaz) … dar sokak 0.45
   - Profil: hiç 0, temkinli 0.6, normal 1, deneyimli 1.15
   - Yağmur ×0.6, gece ×0.9, kuvvetli rüzgar ×0.85
4. `motor süresi = serbest + gecikme × (1 − e)`. Ardından fiziksel sınırlar uygulanır:
   - Tıkanıklıkta motor hızı ≤ max(şerit arası hız, araç hızı + fark). Normal profilde bu 30 km/s
     ya da araç hızı + 25 km/s'dir.
   - Motor süresi serbest akış süresinden kısa, arabanın süresinden uzun olamaz.
   - 50cc ve altı: en fazla 45 km/s ve otoyolsuz rota.

**Trafik kaynağı:**
- **Canlı (Moto+):** Google Routes API `computeRoutes` toplam trafikli ve trafiksiz süreyi verir,
  polyline üzerinde de NORMAL / SLOW / TRAFFIC_JAM bantlarını döner. Gecikme bu bantlara
  ağırlıklı olarak dağıtılır (`src/services/routing/google.ts`).
- **Tahmini (ücretsiz / anahtarsız):** OSRM serbest akış sürelerini, 14 büyükşehrin saat ve gün bazlı
  trafik örüntüsüyle çarpar (`src/services/trafficModel.ts`). Arayüzde "Tahmini trafik" olarak gösterilir.

**Güvenlik puanı** (`src/services/safety.ts`): hızlı yoldaki keskin virajlara, yoğun trafikte
şerit arası sürülen mesafeye, yüksek hızlı yol oranına ve hava koşullarına (yağmur, gece, rüzgar)
göre 0-100 arası verilir. "Güvenli" mod, en hızlı rotadan en fazla %25 uzun olan rotalar içinde en
güvenlisini seçer. "Virajlı" mod, en hızlıdan en fazla %60 uzun rotalar içinde şehir dışı virajlılığı
en yüksek olanı seçer.

## Moto dostu mekanlar

`src/services/places.ts` mekanları OpenStreetMap / Overpass API'den çeker. OSM tüm Türkiye'yi kapsar
ve topluluk tarafından sürekli güncellenir. Kategoriler: akaryakıt, kafe/restoran, moto servis/lastikçi
ve moto park. "Moto dostu" puanı şöyle hesaplanır: moto servisi +3, motosikletle ilgili etiket veya isim
+2, 150 m içinde moto park +1, 7/24 açık akaryakıt +1, kullanıcı onayı (👍) +2. 2 ve üzeri puan
"moto dostu" sayılır.

## Kurulum

```bash
npm install
cp .env.example .env       # isteğe bağlı: Google anahtarı
npx expo start             # Expo Go ile telefonda aç
```

Native build için (mağaza sürümü, harita SDK'sı ve satın alma gerekir):

```bash
npx expo prebuild
npx expo run:android   # veya run:ios
# ya da EAS: npx eas build -p all
```

Testler ve tip kontrolü:

```bash
npm test
npm run typecheck
```

### Ortam değişkenleri

| Değişken | Açıklama |
|---|---|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Routes API (canlı trafik) ve Android Maps SDK. Boş bırakılırsa tahmini trafik kullanılır. |
| `EXPO_PUBLIC_OSRM_URL` | OSRM sunucusu. Varsayılan herkese açık demo sunucudur. |
| `EXPO_PUBLIC_OVERPASS_URLS` | Virgülle ayrılmış Overpass adresleri |
| `EXPO_PUBLIC_NOMINATIM_URL` | Adres arama sunucusu |

## Yayına almadan önce

- **Satın alma:** `src/subscription/purchases.ts` şu an satın almayı yerelde **simüle eder** ve ücret
  almaz. Mağaza için `PurchaseService` arayüzünü RevenueCat (`react-native-purchases`) veya
  `expo-iap` ile uygulayın. Ürün kimlikleri: `moto_plus_monthly`, `moto_plus_yearly`.
- **OSRM / Nominatim / Overpass:** Herkese açık sunucular yoğun kullanım için uygun değildir. Geofabrik'in
  Türkiye OSM verisiyle (`turkey-latest.osm.pbf`) kendi OSRM ve Nominatim sunucunuzu kurun ya da ticari
  bir sağlayıcı kullanın. Verinin güncel kalması için OSM verisini haftalık yenileyin.
- **Google:** Routes API isteklerini ücretlendirir. Anahtarı uygulama kısıtlamalı tutun, tercihen
  isteği kendi sunucunuz üzerinden yapın.
- **Topluluk oyları** şu an cihazda saklanır. Kullanıcılar arasında paylaşmak için bir backend
  (Supabase, Firebase vb.) bağlayın.
- **Hukuki not:** Emniyet şeridinin acil durum dışında kullanılması Karayolları Trafik Kanunu'na göre
  yasaktır. Uygulamada bu seçenek varsayılan olarak kapalıdır, açılırken uyarı gösterilir ve yalnızca
  süre tahminini etkiler.

## Proje yapısı

```
app/                     Ekranlar (expo-router)
  (tabs)/index.tsx       Harita, arama, rota paneli, sürüş modu
  (tabs)/places.tsx      Yakındaki benzinci / kafe / servis listesi
  (tabs)/premium.tsx     Ücretsiz ve Moto+ karşılaştırması, satın alma
  (tabs)/profile.tsx     Motor ve sürüş profili, favoriler
src/services/motoEta.ts  Motosiklet varış süresi motoru
src/services/routing/    Google (canlı) ve OSRM (tahmini) sağlayıcıları, rota sıralama
src/services/            Trafik modeli, güvenlik, mekanlar, arama, hava durumu, navigasyon
src/subscription/        Planlar, özellik yetkileri, satın alma servisi
src/state/AppContext.tsx Üyelik, profil, favoriler, oylar
tests/                   Birim testleri (node:test + tsx)
```
