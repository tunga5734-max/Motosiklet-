export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Yol sınıfı; serbest akış hızından türetilir (sağlayıcılar yol tipini her zaman vermez). */
export type RoadClass = 'motorway' | 'trunk' | 'primary' | 'urban' | 'local';

export type CongestionLevel = 'free' | 'slow' | 'jam';

/** Araç (otomobil) trafiğine göre hesaplanmış bir rota parçası. */
export interface RouteSegment {
  coords: LatLng[];
  distanceM: number;
  /** Trafiksiz (serbest akış) süre, saniye */
  freeFlowS: number;
  /** Otomobil için trafikli süre, saniye */
  trafficS: number;
  roadClass: RoadClass;
}

export interface RouteStep {
  instruction: string;
  distanceM: number;
  location: LatLng;
}

export type TrafficSource = 'live' | 'estimated';

/** Sağlayıcıdan (Google / OSRM) gelen otomobil rotası. */
export interface CarRoute {
  id: string;
  provider: 'google' | 'osrm';
  summary: string;
  distanceM: number;
  freeFlowS: number;
  trafficS: number;
  polyline: LatLng[];
  segments: RouteSegment[];
  steps: RouteStep[];
  trafficSource: TrafficSource;
}

export type FilteringLevel = 'none' | 'cautious' | 'normal' | 'experienced';

export interface RiderProfile {
  /** Şerit arası sürüş alışkanlığı */
  filtering: FilteringLevel;
  /** Emniyet şeridi kullanımı (yasal değildir, varsayılan kapalı) */
  useShoulder: boolean;
  /** Motor silindir hacmi (cc). 50cc ve altı otoyola çıkamaz. */
  engineCc: number;
}

export interface RideConditions {
  rain: boolean;
  night: boolean;
  /** km/s cinsinden rüzgar hızı */
  windKmh?: number;
}

export interface MotoSegment extends RouteSegment {
  motoS: number;
  congestion: CongestionLevel;
}

export interface SafetyReport {
  /** 0-100, yüksek = daha güvenli */
  score: number;
  /** km başına keskin viraj sayısı */
  sharpTurnsPerKm: number;
  /** Yoğun trafikte şerit arası sürülecek mesafe oranı (0-1) */
  filteringShare: number;
  /** Yüksek hızlı yol oranı (0-1) */
  highSpeedShare: number;
  /** Virajlılık (km başına toplam yön değişimi, derece) */
  curvinessDegPerKm: number;
  warnings: string[];
}

export interface MotoRoute {
  route: CarRoute;
  motoS: number;
  carS: number;
  savedS: number;
  segments: MotoSegment[];
  safety: SafetyReport;
}

export type RouteMode = 'fastest' | 'safe' | 'curvy';

export type PlaceCategory = 'fuel' | 'cafe' | 'service' | 'parking';

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  location: LatLng;
  tags: Record<string, string>;
  /** 0+ ; 2 ve üzeri "moto dostu" kabul edilir */
  motoScore: number;
  motoFriendly: boolean;
  open24h: boolean;
  distanceM?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  location: LatLng;
}
