export const colors = {
  primary: '#F25C05', // turuncu — motosiklet
  primaryDark: '#C24600',
  car: '#5B6B7F',
  bg: '#FFFFFF',
  surface: '#F5F6F8',
  text: '#14181F',
  muted: '#6B7280',
  border: '#E3E6EB',
  free: '#1DA851',
  slow: '#F2A007',
  jam: '#D7263D',
  premium: '#7B3FE4',
  fuel: '#1F6FEB',
  cafe: '#A0522D',
  service: '#333F48',
  parking: '#0E9F9A',
};

export const congestionColor = { free: colors.free, slow: colors.slow, jam: colors.jam } as const;

export const categoryMeta = {
  fuel: { label: 'Benzinci', color: colors.fuel, icon: 'local-gas-station' },
  cafe: { label: 'Kafe / Mola', color: colors.cafe, icon: 'local-cafe' },
  service: { label: 'Moto Servis', color: colors.service, icon: 'build' },
  parking: { label: 'Moto Park', color: colors.parking, icon: 'local-parking' },
} as const;
