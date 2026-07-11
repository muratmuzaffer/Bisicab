'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from 'react-map-gl';
import {
  Bike,
  Crosshair,
  LocateFixed,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface ActiveDriver {
  user_id: string;
  full_name: string | null;
  driver_email: string | null;
  plate: string | null;
  current_lat: number | null;
  current_lng: number | null;
}

const IZMIR_CENTER = { longitude: 27.1428, latitude: 38.4327, zoom: 13 };

function driverLabel(d: ActiveDriver): string {
  return d.full_name?.trim() || d.driver_email || 'Sürücü';
}

function hasLocation(d: ActiveDriver): d is ActiveDriver & {
  current_lat: number;
  current_lng: number;
} {
  return d.current_lat != null && d.current_lng != null;
}

export function LiveMap({
  drivers,
  activeCount,
  onMapCount,
}: {
  drivers: ActiveDriver[];
  activeCount: number;
  onMapCount: number;
}) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const didFitRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const onMapDrivers = useMemo(() => drivers.filter(hasLocation), [drivers]);
  const waitingDrivers = useMemo(
    () => drivers.filter((d) => !hasLocation(d)),
    [drivers]
  );

  useEffect(() => {
    const channel = supabase
      .channel('admin-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers_profiles' },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vehicles' },
        () => router.refresh()
      )
      .subscribe();

    const t = setInterval(() => router.refresh(), 5000);

    return () => {
      clearInterval(t);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  const flyToDriver = useCallback((d: ActiveDriver, zoom = 16) => {
    if (!hasLocation(d)) return;
    setSelectedId(d.user_id);
    mapRef.current?.flyTo({
      center: [d.current_lng, d.current_lat],
      zoom,
      duration: 1200,
      essential: true,
    });
  }, []);

  const fitAllDrivers = useCallback(() => {
    if (onMapDrivers.length === 0) {
      mapRef.current?.flyTo({
        center: [IZMIR_CENTER.longitude, IZMIR_CENTER.latitude],
        zoom: IZMIR_CENTER.zoom,
        duration: 800,
      });
      setSelectedId(null);
      return;
    }

    if (onMapDrivers.length === 1) {
      flyToDriver(onMapDrivers[0], 15);
      return;
    }

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const d of onMapDrivers) {
      minLng = Math.min(minLng, d.current_lng);
      minLat = Math.min(minLat, d.current_lat);
      maxLng = Math.max(maxLng, d.current_lng);
      maxLat = Math.max(maxLat, d.current_lat);
    }

    mapRef.current?.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 80, duration: 900, maxZoom: 16 }
    );
    setSelectedId(null);
  }, [flyToDriver, onMapDrivers]);

  const recenterIzmir = useCallback(() => {
    mapRef.current?.flyTo({
      center: [IZMIR_CENTER.longitude, IZMIR_CENTER.latitude],
      zoom: IZMIR_CENTER.zoom,
      duration: 800,
    });
    setSelectedId(null);
  }, []);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.zoomTo(map.getZoom() + delta, { duration: 250 });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!mapReady || didFitRef.current) return;
    didFitRef.current = true;
    const t = setTimeout(() => fitAllDrivers(), 400);
    return () => clearTimeout(t);
  }, [mapReady, fitAllDrivers]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Canlı Takip</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bisiklet konumları ~5 sn&apos;de bir güncellenir
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-brand/20 px-3 py-1 text-sm font-medium text-brand-dark">
            {activeCount} aktif BisiCab
          </span>
          {onMapCount < activeCount ? (
            <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              {onMapCount} haritada · {activeCount - onMapCount} konum bekliyor
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => router.refresh()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-medium hover:bg-muted/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Yenile
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Sürücü listesi */}
        <aside className="w-full shrink-0 rounded-xl border border-border bg-white shadow-sm lg:w-72">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-dark">Aktif sürücüler</h2>
            <p className="text-xs text-muted-foreground">Tıklayarak haritada odaklan</p>
          </div>
          <ul className="max-h-[280px] overflow-y-auto lg:max-h-[calc(75vh-2rem)]">
            {drivers.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Kullanımda bisiklet yok
              </li>
            ) : (
              drivers.map((d) => {
                const located = hasLocation(d);
                const selected = selectedId === d.user_id;
                return (
                  <li key={d.user_id}>
                    <button
                      type="button"
                      disabled={!located}
                      onClick={() => flyToDriver(d)}
                      className={`flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 ${
                        selected ? 'bg-brand/10' : 'hover:bg-canvas/80'
                      } ${!located ? 'cursor-default opacity-60' : ''}`}
                    >
                      <div
                        className={`mt-0.5 rounded-full p-1.5 ${
                          located ? 'bg-brand/25' : 'bg-muted'
                        }`}
                      >
                        <Bike className="h-3.5 w-3.5 text-brand-deep" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {driverLabel(d)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {d.plate ?? '—'}
                          {d.driver_email && d.full_name
                            ? ` · ${d.driver_email}`
                            : ''}
                        </p>
                        <p
                          className={`mt-1 text-xs ${
                            located ? 'text-success' : 'text-muted-foreground'
                          }`}
                        >
                          {located ? 'Haritada' : 'Konum bekleniyor'}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          {waitingDrivers.length > 0 ? (
            <div className="border-t border-border bg-canvas/50 px-4 py-2 text-xs text-muted-foreground">
              Konum gelmeyen sürücüler mesaide olabilir; telefonda konum izni
              ve uygulama açık olmalı.
            </div>
          ) : null}
        </aside>

        {/* Harita */}
        <div
          ref={containerRef}
          className="relative min-h-[420px] flex-1 overflow-hidden rounded-xl border border-border bg-muted"
        >
          {token ? (
            <>
              <Map
                ref={mapRef}
                mapboxAccessToken={token}
                initialViewState={IZMIR_CENTER}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                style={{ width: '100%', height: '100%', minHeight: '420px' }}
                onLoad={() => setMapReady(true)}
                reuseMaps
                attributionControl
              >
                <NavigationControl position="bottom-right" showCompass visualizePitch />

                {onMapDrivers.map((d) => {
                  const selected = selectedId === d.user_id;
                  return (
                    <Marker
                      key={d.user_id}
                      longitude={d.current_lng}
                      latitude={d.current_lat}
                      anchor="bottom"
                      onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        flyToDriver(d, 17);
                      }}
                    >
                      <div
                        className={`flex cursor-pointer flex-col items-center transition-transform ${
                          selected ? 'scale-110' : 'hover:scale-105'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/bisicab-marker.png"
                          alt=""
                          className={`h-12 w-12 rounded-xl object-cover shadow-lg ring-2 ${
                            selected ? 'ring-brand-dark' : 'ring-white'
                          }`}
                        />
                        <span
                          className={`mt-1 max-w-[140px] truncate rounded px-2 py-0.5 text-xs font-semibold shadow ${
                            selected
                              ? 'bg-brand-dark text-white'
                              : 'bg-white text-brand-dark'
                          }`}
                        >
                          {driverLabel(d)}
                          {d.plate ? ` · ${d.plate}` : ''}
                        </span>
                      </div>
                    </Marker>
                  );
                })}
              </Map>

              {/* Özel zoom / odak kontrolleri */}
              <div className="absolute left-3 top-3 flex flex-col gap-2">
                <div className="overflow-hidden rounded-lg border border-border bg-white shadow-md">
                  <button
                    type="button"
                    aria-label="Yakınlaştır"
                    onClick={() => zoomBy(1)}
                    className="flex h-9 w-9 items-center justify-center border-b border-border hover:bg-muted/60"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Uzaklaştır"
                    onClick={() => zoomBy(-1)}
                    className="flex h-9 w-9 items-center justify-center hover:bg-muted/60"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  title="Tüm bisikletleri göster"
                  onClick={fitAllDrivers}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white shadow-md hover:bg-muted/60"
                >
                  <Crosshair className="h-4 w-4 text-brand-deep" />
                </button>

                <button
                  type="button"
                  title="İzmir hattına dön"
                  onClick={recenterIzmir}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white shadow-md hover:bg-muted/60"
                >
                  <LocateFixed className="h-4 w-4 text-brand-deep" />
                </button>

                <button
                  type="button"
                  title="Tam ekran"
                  onClick={toggleFullscreen}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white shadow-md hover:bg-muted/60"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Lejant */}
              <div className="absolute bottom-3 left-3 rounded-lg border border-border bg-white/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/bisicab-marker.png"
                    alt=""
                    className="h-5 w-5 rounded object-cover"
                  />
                  <span>BisiCab ikonu = aktif bisiklet</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Tekerlek / +/- ile zoom · sürükleyerek kaydır
                </p>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[420px] items-center justify-center text-muted-foreground">
              NEXT_PUBLIC_MAPBOX_TOKEN tanımlı değil.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
