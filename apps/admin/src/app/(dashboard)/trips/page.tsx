import { createSupabaseServer } from '@/lib/supabase-server';
import { TripsClient, type TripRow } from '@/components/trips-client';

export const dynamic = 'force-dynamic';

const TRIPS_SELECT_BASE =
  'id, created_at, total_distance, total_duration, total_amount, status, receipt_image_url, start_zone, end_zone, start_stop, end_stop, start_lat, start_lng, end_lat, end_lng, passenger_male, passenger_female, passenger_child, has_tourist, users:driver_id(full_name, email), vehicles:vehicle_id(plate)';

const TRIPS_SELECT_EXTENDED =
  `${TRIPS_SELECT_BASE}, route_stops, route_path, passenger_child_male, passenger_child_female`;

/** receipt_image_url path veya eski imzalı URL olabilir → görüntülenebilir URL. */
async function toDisplayUrl(
  supabase: ReturnType<typeof createSupabaseServer>,
  stored: string | null
): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith('http://') || stored.startsWith('https://')) {
    const marker = '/object/sign/receipts/';
    const idx = stored.indexOf(marker);
    if (idx >= 0) {
      const after = stored.slice(idx + marker.length);
      const path = decodeURIComponent(after.split('?')[0] ?? '');
      if (path) {
        const { data } = await supabase.storage
          .from('receipts')
          .createSignedUrl(path, 60 * 60 * 12);
        if (data?.signedUrl) return data.signedUrl;
      }
    }
    return stored;
  }
  const { data } = await supabase.storage
    .from('receipts')
    .createSignedUrl(stored, 60 * 60 * 12);
  return data?.signedUrl ?? null;
}

function mapTripRow(
  t: Record<string, unknown>,
  routeSummary: typeof import('@bisicab/shared').routeSummary,
  zoneLabel: typeof import('@bisicab/shared').zoneLabel,
  passengersSummary: typeof import('@bisicab/shared').passengersSummary
): Omit<TripRow, 'receipt_image_url'> & { receipt_image_url: string | null } {
  const routeStops = (t.route_stops as string[] | null | undefined) ?? null;
  const rawPath = t.route_path as Array<{ lat: number; lng: number }> | null | undefined;
  const routePath =
    Array.isArray(rawPath) && rawPath.length > 0
      ? rawPath.filter(
          (p) =>
            typeof p?.lat === 'number' &&
            typeof p?.lng === 'number' &&
            Number.isFinite(p.lat) &&
            Number.isFinite(p.lng)
        )
      : null;
  return {
    id: t.id as string,
    created_at: t.created_at as string,
    total_distance: t.total_distance as number,
    total_duration: t.total_duration as number,
    total_amount: t.total_amount as number,
    status: t.status as string,
    receipt_image_url: (t.receipt_image_url as string | null) ?? null,
    start_zone: (t.start_zone as string | null) ?? null,
    end_zone: (t.end_zone as string | null) ?? null,
    start_stop: (t.start_stop as string | null) ?? null,
    end_stop: (t.end_stop as string | null) ?? null,
    route_stops: routeStops,
    route_path: routePath?.length ? routePath : null,
    start_lat: (t.start_lat as number | null) ?? null,
    start_lng: (t.start_lng as number | null) ?? null,
    end_lat: (t.end_lat as number | null) ?? null,
    end_lng: (t.end_lng as number | null) ?? null,
    route_label:
      routeStops?.length || t.start_stop || t.end_stop
        ? routeSummary(
            t.start_stop as string | null,
            t.end_stop as string | null,
            routeStops
          )
        : t.start_zone || t.end_zone
          ? `${zoneLabel(t.start_zone as string | null)} → ${zoneLabel(t.end_zone as string | null)}`
          : '—',
    passengers_label: passengersSummary({
      male: Number(t.passenger_male ?? 0),
      female: Number(t.passenger_female ?? 0),
      child: Number(t.passenger_child ?? 0),
      childMale: Number(t.passenger_child_male ?? 0),
      childFemale: Number(t.passenger_child_female ?? 0),
    }),
    has_tourist: Boolean(t.has_tourist),
    users: t.users as TripRow['users'],
    vehicles: t.vehicles as TripRow['vehicles'],
  };
}

export default async function TripsPage() {
  const supabase = createSupabaseServer();
  const { routeSummary, zoneLabel, passengersSummary } = await import('@bisicab/shared');

  let queryError: string | null = null;
  let rows: Record<string, unknown>[] = [];

  const extended = await supabase
    .from('trips')
    .select(TRIPS_SELECT_EXTENDED)
    .order('created_at', { ascending: false })
    .limit(500);

  if (extended.error) {
    const fallback = await supabase
      .from('trips')
      .select(TRIPS_SELECT_BASE)
      .order('created_at', { ascending: false })
      .limit(500);

    if (fallback.error) {
      queryError = fallback.error.message;
    } else {
      rows = (fallback.data as Record<string, unknown>[]) ?? [];
    }
  } else {
    rows = (extended.data as Record<string, unknown>[]) ?? [];
  }

  const trips: TripRow[] = await Promise.all(
    rows.map(async (t) => {
      const mapped = mapTripRow(t, routeSummary, zoneLabel, passengersSummary);
      return {
        ...mapped,
        receipt_image_url: await toDisplayUrl(supabase, mapped.receipt_image_url),
      };
    })
  );

  return <TripsClient trips={trips} queryError={queryError} />;
}
