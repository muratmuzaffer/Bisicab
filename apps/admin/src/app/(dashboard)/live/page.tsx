import { createSupabaseServer } from '@/lib/supabase-server';
import { isDriverUser, pickJoinedUser } from '@/lib/supabase-join';
import { LiveMap, type ActiveDriver } from '@/components/live-map';

export const dynamic = 'force-dynamic';

export default async function LivePage() {
  const supabase = createSupabaseServer();

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select(
      'plate, current_driver_id, users:current_driver_id(full_name, email, role)'
    )
    .eq('status', 'in_use');

  type VehicleRow = {
    plate: string;
    current_driver_id: string | null;
    users: Parameters<typeof pickJoinedUser>[0];
  };

  const rows = (vehicles ?? []) as VehicleRow[];

  const activeVehicles = rows.filter(
    (v) => v.current_driver_id && isDriverUser(v.users)
  );

  const driverIds = activeVehicles
    .map((v: { current_driver_id: string | null }) => v.current_driver_id)
    .filter((id: string | null): id is string => !!id);

  const locByDriver = new Map<string, { lat: number | null; lng: number | null }>();
  if (driverIds.length > 0) {
    const { data: profiles } = await supabase
      .from('drivers_profiles')
      .select('user_id, current_lat, current_lng')
      .in('user_id', driverIds);

    (profiles ?? []).forEach(
      (p: {
        user_id: string;
        current_lat: number | null;
        current_lng: number | null;
      }) => locByDriver.set(p.user_id, { lat: p.current_lat, lng: p.current_lng })
    );
  }

  const drivers: ActiveDriver[] = activeVehicles.map((v) => {
      const user = pickJoinedUser(v.users);
      const loc = v.current_driver_id
        ? locByDriver.get(v.current_driver_id)
        : undefined;
      return {
        user_id: v.current_driver_id ?? v.plate,
        full_name: user?.full_name ?? null,
        driver_email: user?.email ?? null,
        plate: v.plate,
        current_lat: loc?.lat ?? null,
        current_lng: loc?.lng ?? null,
      };
    });

  const onMap = drivers.filter(
    (d) => d.current_lat != null && d.current_lng != null
  ).length;

  return (
    <LiveMap
      drivers={drivers}
      activeCount={drivers.length}
      onMapCount={onMap}
    />
  );
}
