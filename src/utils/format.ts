export function formatDuration(seconds: number): string {
  const totalMin = Math.max(1, Math.round(seconds / 60));
  if (totalMin < 60) return `${totalMin} dk`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return km < 100 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`;
}

export function formatArrival(seconds: number, now = new Date()): string {
  const t = new Date(now.getTime() + seconds * 1000);
  return t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
