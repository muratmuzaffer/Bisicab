'use client';

import { useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import { Bike } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ActiveDriver {
  user_id: string;
  full_name: string | null;
  current_lat: number | null;
  current_lng: number | null;
}

// İzmir Konak / Alsancak hattı merkez koordinatı.
const IZMIR_CENTER = { longitude: 27.1428, latitude: 38.4327, zoom: 13 };

export default function LivePage() {
  const [drivers, setDrivers] = useState<ActiveDriver[]>([]);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('drivers_profiles')
        .select('user_id, current_lat, current_lng, users(full_name)')
        .eq('is_active', true);

      const mapped: ActiveDriver[] = (data ?? []).map((d: any) => ({
        user_id: d.user_id,
        full_name: d.users?.full_name ?? null,
        current_lat: d.current_lat,
        current_lng: d.current_lng,
      }));
      setDrivers(mapped);
    };

    void load();

    // Realtime: sürücü konum güncellemelerini dinle.
    const channel = supabase
      .channel('admin-live-drivers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drivers_profiles' },
        () => void load()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Canlı Takip</h1>
        <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-medium text-brand-dark">
          {drivers.length} aktif BisiCab
        </span>
      </div>

      <div className="h-[75vh] overflow-hidden rounded-lg border border-border">
        {token ? (
          <Map
            mapboxAccessToken={token}
            initialViewState={IZMIR_CENTER}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: '100%', height: '100%' }}
          >
            {drivers
              .filter((d) => d.current_lat != null && d.current_lng != null)
              .map((d) => (
                <Marker
                  key={d.user_id}
                  longitude={d.current_lng!}
                  latitude={d.current_lat!}
                  anchor="bottom"
                >
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-brand p-2 shadow-lg">
                      <Bike className="h-4 w-4 text-white" />
                    </div>
                    <span className="mt-1 rounded bg-white px-2 py-0.5 text-xs font-semibold shadow">
                      {d.full_name ?? 'Sürücü'}
                    </span>
                  </div>
                </Marker>
              ))}
          </Map>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            NEXT_PUBLIC_MAPBOX_TOKEN tanımlı değil.
          </div>
        )}
      </div>
    </div>
  );
}
