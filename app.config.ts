import type { ExpoConfig } from 'expo/config';

const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const config: ExpoConfig = {
  name: 'MotoRota',
  slug: 'motorota',
  scheme: 'motorota',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.motorota.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Konumunuz rota hesaplamak, yakındaki benzinci ve moto dostu mekanları göstermek için kullanılır.',
    },
  },
  android: {
    package: 'com.motorota.app',
    adaptiveIcon: {
      backgroundColor: '#F25C05',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    // Android'de harita döşemeleri için Google Maps SDK anahtarı gerekir
    config: { googleMaps: { apiKey: googleMapsKey } },
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#F25C05' }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Konumunuz rota hesaplamak, yakındaki benzinci ve moto dostu mekanları göstermek için kullanılır.',
      },
    ],
  ],
  experiments: { typedRoutes: false },
};

export default config;
