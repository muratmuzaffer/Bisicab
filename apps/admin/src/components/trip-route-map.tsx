'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from 'react-map-gl';
import { stopById, stopLabel, tripStopSequence, zoneIdForStop, zoneLabel } from '@bisicab/shared';

const IZMIR_CENTER = { longitude: 27.1428, latitude: 38.4327, zoom: 13 };

export interface TripMapData {
  status: string;
  route_stops: string[] | null;
  start_stop: string | null;
  end_stop: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  route_path: Array<{ lat: number; lng: number }> | null;
}

function parseRoutePath(
  raw: Array<{ lat: number; lng: number }> | null | undefined
): Array<{ lat: number; lng: number }> {
  if (!raw?.length) return [];
  return raw.filter(
    (p) =>
      typeof p.lat === 'number' &&
      typeof p.lng === 'number' &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng)
  );
}

function hasGpsPoint(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null;
}

export function TripRouteMap({ trip }: { trip: TripMapData }) {
  const mapRef = useRef<MapRef>(null);
  const [mapReady, setMapReady] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const gpsPath = useMemo(() => parseRoutePath(trip.route_path), [trip.route_path]);
  const isOngoing = trip.status === 'ongoing';

  const stopIds = useMemo(
    () =>
      tripStopSequence({
        routeStops: trip.route_stops,
        startStop: trip.start_stop,
        endStop: trip.end_stop,
      }),
    [trip.end_stop, trip.route_stops, trip.start_stop]
  );

  const gpsLine = useMemo(() => {
    if (gpsPath.length >= 2) {
      return {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: gpsPath.map((p) => [p.lng, p.lat]),
        },
      };
    }
    return null;
  }, [gpsPath]);

  const fallbackLine = useMemo(() => {
    if (gpsPath.length >= 2) return null;
    if (
      !hasGpsPoint(trip.start_lat, trip.start_lng) ||
      !hasGpsPoint(trip.end_lat, trip.end_lng)
    ) {
      return null;
    }
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [trip.start_lng!, trip.start_lat!],
          [trip.end_lng!, trip.end_lat!],
        ],
      },
    };
  }, [gpsPath.length, trip.end_lat, trip.end_lng, trip.start_lat, trip.start_lng]);

  const pathStart = gpsPath[0] ?? null;
  const pathEnd = gpsPath.length > 0 ? gpsPath[gpsPath.length - 1] : null;

  const fitRoute = useCallback(() => {
    const points: Array<[number, number]> = gpsPath.map((p) => [p.lng, p.lat]);
    if (points.length === 0 && fallbackLine) {
      points.push(
        [trip.start_lng!, trip.start_lat!],
        [trip.end_lng!, trip.end_lat!]
      );
    }
    if (points.length === 0) {
      mapRef.current?.flyTo({
        center: [IZMIR_CENTER.longitude, IZMIR_CENTER.latitude],
        zoom: IZMIR_CENTER.zoom,
        duration: 600,
      });
      return;
    }
    if (points.length === 1) {
      mapRef.current?.flyTo({ center: points[0], zoom: 16, duration: 600 });
      return;
    }
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of points) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
    mapRef.current?.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 72, duration: 700, maxZoom: 17 }
    );
  }, [fallbackLine, gpsPath, trip.end_lat, trip.end_lng, trip.start_lat, trip.start_lng]);

  useEffect(() => {
    if (!mapReady) return;
    const t = setTimeout(() => fitRoute(), 300);
    return () => clearTimeout(t);
  }, [mapReady, fitRoute, gpsPath.length]);

  if (!token) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        Harita için NEXT_PUBLIC_MAPBOX_TOKEN tanımlı değil.
      </div>
    );
  }

  const hasTrack = gpsPath.length >= 2 || Boolean(fallbackLine);

  if (!hasTrack) {
    return (
      <div className="space-y-4">
        <div className="flex h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">GPS izi henüz yok</p>
          <p className="mt-2 text-xs">
            {isOngoing
              ? 'Sürücü hareket ettikçe rota birkaç saniyede bir güncellenir.'
              : 'Bu sürüş tamamlanmadan önce kaydedilmiş olabilir veya mobil uygulama güncel değil.'}
          </p>
        </div>
        {stopIds.length > 0 ? <StopList stopIds={stopIds} /> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative h-[min(460px,58vh)] overflow-hidden rounded-lg border border-border bg-muted">
        <Map
          ref={mapRef}
          mapboxAccessToken={token}
          initialViewState={IZMIR_CENTER}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ width: '100%', height: '100%' }}
          onLoad={() => setMapReady(true)}
          reuseMaps
        >
          <NavigationControl position="bottom-right" showCompass visualizePitch />

          {gpsLine ? (
            <Source id="gps-track" type="geojson" data={gpsLine}>
              <Layer
                id="gps-track-line"
                type="line"
                paint={{
                  'line-color': '#F5C518',
                  'line-width': 5,
                  'line-opacity': 0.95,
                }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </Source>
          ) : null}

          {fallbackLine ? (
            <Source id="gps-fallback" type="geojson" data={fallbackLine}>
              <Layer
                id="gps-fallback-line"
                type="line"
                paint={{
                  'line-color': '#F5C518',
                  'line-width': 3,
                  'line-opacity': 0.5,
                  'line-dasharray': [2, 2],
                }}
                layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              />
            </Source>
          ) : null}

          {pathStart ? (
            <Marker longitude={pathStart.lng} latitude={pathStart.lat} anchor="bottom">
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-success px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  Başlangıç
                </div>
                <div className="mt-0.5 h-3 w-3 rounded-full border-2 border-white bg-success shadow" />
              </div>
            </Marker>
          ) : null}

          {pathEnd && gpsPath.length > 1 ? (
            <Marker longitude={pathEnd.lng} latitude={pathEnd.lat} anchor="bottom">
              <div className="flex flex-col items-center">
                <div className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white shadow">
                  {isOngoing ? 'Son konum' : 'Bitiş'}
                </div>
                <div className="mt-0.5 h-3 w-3 rounded-full border-2 border-white bg-danger shadow" />
              </div>
            </Marker>
          ) : null}
        </Map>

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {isOngoing ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-dark px-3 py-1 text-xs font-semibold text-white shadow">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Canlı GPS
            </span>
          ) : null}
          <span className="rounded-full border border-border bg-white/95 px-3 py-1 text-xs font-medium shadow backdrop-blur-sm">
            {gpsPath.length >= 2
              ? `${gpsPath.length} GPS noktası`
              : 'Kısmi GPS kaydı'}
          </span>
        </div>

        <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-5 rounded bg-[#F5C518]" />
            <span>Sürücünün gerçekten geçtiği yol</span>
          </div>
        </div>
      </div>

      {stopIds.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sürücünün seçtiği duraklar (plan)
          </p>
          <StopList stopIds={stopIds} />
        </div>
      ) : null}
    </div>
  );
}

function StopList({ stopIds }: { stopIds: string[] }) {
  return (
    <ol className="space-y-2">
      {stopIds.map((id, i) => {
        const stop = stopById(id);
        const zone = zoneLabel(zoneIdForStop(id));
        return (
          <li
            key={`${id}-${i}`}
            className="flex items-start gap-3 rounded-lg border border-border bg-canvas/50 px-3 py-2 text-sm"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{stopLabel(id)}</p>
              {stop?.tag ? (
                <p className="text-xs text-muted-foreground">{stop.tag}</p>
              ) : zone !== '—' ? (
                <p className="text-xs text-muted-foreground">{zone}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
