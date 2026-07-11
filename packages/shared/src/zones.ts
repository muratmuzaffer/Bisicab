/** Alsancak–Konak hattı: bölgeler ve içlerindeki duraklar. */

export interface RouteStop {
  id: string;
  name: string;
  /** Örn. "Durak Dışı" — yoksa null (resmi durak). */
  tag: string | null;
  /** Yaklaşık konum (İzmir kordon hattı). */
  lat: number;
  lng: number;
}

export interface RouteZone {
  id: string;
  name: string;
  icon: 'anchor' | 'museum' | 'wave' | 'tower' | 'tree';
  stops: RouteStop[];
}

/** Resmi duraklar: Liman, Vasıf Çınar, Lozan, Montrö. Diğerleri Durak Dışı. */
export const ROUTE_ZONES: RouteZone[] = [
  {
    id: 'alsancak',
    name: 'ALSANCAK',
    icon: 'anchor',
    stops: [
      { id: 'alsancak-liman', name: 'Liman', tag: null, lat: 38.4374, lng: 27.1433 },
      { id: 'alsancak-iskele', name: 'Alsancak İskele', tag: 'Durak Dışı', lat: 38.4358, lng: 27.1405 },
      { id: 'alsancak-gundogdu', name: 'Gündoğdu Meydanı', tag: 'Durak Dışı', lat: 38.433, lng: 27.1385 },
    ],
  },
  {
    id: 'kultur',
    name: 'KÜLTÜR',
    icon: 'museum',
    stops: [
      { id: 'kultur-vasif', name: 'Vasıf Çınar', tag: null, lat: 38.431, lng: 27.1365 },
      { id: 'kultur-cumhuriyet', name: 'Cumhuriyet Meydanı', tag: 'Durak Dışı', lat: 38.4285, lng: 27.1345 },
    ],
  },
  {
    id: 'akdeniz',
    name: 'AKDENİZ',
    icon: 'wave',
    stops: [
      { id: 'akdeniz-pasaport', name: 'Pasaport İskelesi', tag: 'Durak Dışı', lat: 38.425, lng: 27.131 },
      { id: 'akdeniz-konak-pier', name: 'Konak Pier', tag: 'Durak Dışı', lat: 38.4205, lng: 27.1275 },
    ],
  },
  {
    id: 'konak',
    name: 'KONAK',
    icon: 'tower',
    stops: [
      { id: 'konak-iskele', name: 'Konak İskele', tag: 'Durak Dışı', lat: 38.4185, lng: 27.1288 },
      { id: 'konak-saat-kulesi', name: 'Saat Kulesi', tag: 'Durak Dışı', lat: 38.4192, lng: 27.1285 },
    ],
  },
  {
    id: 'kulturpark',
    name: 'KÜLTÜRPARK',
    icon: 'tree',
    stops: [
      { id: 'kulturpark-lozan', name: 'Lozan', tag: null, lat: 38.4155, lng: 27.1335 },
      { id: 'kulturpark-montro', name: 'Montrö', tag: null, lat: 38.414, lng: 27.1358 },
      { id: 'kulturpark-basmane', name: 'Basmane', tag: 'Durak Dışı', lat: 38.4105, lng: 27.1395 },
    ],
  },
];

/** Yolcu kapasitesi: en fazla 2 yetişkin + 2 çocuk. */
export const PASSENGER_LIMITS = {
  maxTotal: 4,
  maxAdults: 2,
  maxChildren: 2,
  adultMale: 2,
  adultFemale: 2,
  childMale: 2,
  childFemale: 2,
} as const;

/** Güzergahta en fazla durak sayısı. */
export const MAX_ROUTE_STOPS = 6;

export function zoneById(id: string | null | undefined): RouteZone | null {
  if (!id) return null;
  return ROUTE_ZONES.find((z) => z.id === id) ?? null;
}

export function stopById(id: string | null | undefined): RouteStop | null {
  if (!id) return null;
  for (const z of ROUTE_ZONES) {
    const s = z.stops.find((x) => x.id === id);
    if (s) return s;
  }
  return null;
}

export function stopLabel(id: string | null | undefined): string {
  const s = stopById(id);
  if (!s) return '—';
  return s.tag ? `${s.name} (${s.tag})` : s.name;
}

export function zoneLabel(id: string | null | undefined): string {
  return zoneById(id)?.name ?? '—';
}

/** Admin / geçmiş için kısa güzergah metni. */
export function routeSummaryFromStops(stopIds: string[] | null | undefined): string {
  if (!stopIds?.length) return '—';
  return stopIds.map((id) => stopLabel(id)).join(' → ');
}

/** Admin / geçmiş için kısa güzergah metni. */
export function routeSummary(
  startStopId: string | null | undefined,
  endStopId: string | null | undefined,
  routeStops?: string[] | null
): string {
  if (routeStops && routeStops.length > 0) {
    return routeSummaryFromStops(routeStops);
  }
  if (!startStopId && !endStopId) return '—';
  return `${stopLabel(startStopId)} → ${stopLabel(endStopId)}`;
}

export function passengersSummary(params: {
  male: number;
  female: number;
  child?: number;
  childMale?: number;
  childFemale?: number;
}): string {
  const parts: string[] = [];
  if (params.male) parts.push(`${params.male}E`);
  if (params.female) parts.push(`${params.female}K`);
  const cm = params.childMale ?? 0;
  const cf = params.childFemale ?? 0;
  if (cm) parts.push(`${cm} erkek çocuk`);
  if (cf) parts.push(`${cf} kız çocuk`);
  const legacyChild = params.child ?? 0;
  if (legacyChild && cm === 0 && cf === 0) parts.push(`${legacyChild}Ç`);
  return parts.length ? parts.join(' · ') : '—';
}

export function zoneIdForStop(stopId: string): string | null {
  for (const z of ROUTE_ZONES) {
    if (z.stops.some((s) => s.id === stopId)) return z.id;
  }
  return null;
}

/** Sürüş kaydından sıralı durak id listesi. */
export function tripStopSequence(params: {
  routeStops?: string[] | null;
  startStop?: string | null;
  endStop?: string | null;
}): string[] {
  if (params.routeStops?.length) return params.routeStops;
  const ids: string[] = [];
  if (params.startStop) ids.push(params.startStop);
  if (params.endStop && params.endStop !== params.startStop) ids.push(params.endStop);
  return ids;
}

export function stopCoords(
  stopId: string | null | undefined
): { lat: number; lng: number } | null {
  const s = stopById(stopId);
  if (!s) return null;
  return { lat: s.lat, lng: s.lng };
}

/** Bölge merkezi (eski kayıtlar için yedek). */
export function zoneCentroid(
  zoneId: string | null | undefined
): { lat: number; lng: number } | null {
  const z = zoneById(zoneId);
  if (!z?.stops.length) return null;
  const lat = z.stops.reduce((s, x) => s + x.lat, 0) / z.stops.length;
  const lng = z.stops.reduce((s, x) => s + x.lng, 0) / z.stops.length;
  return { lat, lng };
}
