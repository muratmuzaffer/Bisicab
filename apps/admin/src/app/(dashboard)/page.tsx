import { createSupabaseServer } from '@/lib/supabase-server';
import { isDriverUser, pickJoinedRecord, pickJoinedUser } from '@/lib/supabase-join';
import {
  DashboardClient,
  type ActiveVehicle,
  type DashboardStats,
  type RecentTrip,
} from '@/components/dashboard-client';

export const dynamic = 'force-dynamic';

function routeLabel(t: {
  start_zone?: string | null;
  end_zone?: string | null;
  start_stop?: string | null;
  end_stop?: string | null;
}): string {
  const from = t.start_stop || t.start_zone || '?';
  const to = t.end_stop || t.end_zone || '?';
  return `${from} → ${to}`;
}

export default async function DashboardPage() {
  const supabase = createSupabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let adminName = user?.email?.split('@')[0] ?? 'Admin';
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .single();
    if (profile?.full_name) adminName = profile.full_name;
  }

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startOfDay);
  startYesterday.setDate(startYesterday.getDate() - 1);

  const [
    { data: vehicles },
    { data: tripsToday },
    { data: tripsYesterday },
    { count: ongoingTrips },
    { data: activeShiftsRaw },
    { data: recentTripsRaw },
  ] = await Promise.all([
    supabase
      .from('vehicles')
      .select(
        'id, plate, label, status, current_driver_id, users:current_driver_id(full_name, email, role)'
      )
      .order('plate'),
    supabase
      .from('trips')
      .select('total_amount, total_distance')
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString()),
    supabase
      .from('trips')
      .select('total_amount, total_distance')
      .eq('status', 'completed')
      .gte('created_at', startYesterday.toISOString())
      .lt('created_at', startOfDay.toISOString()),
    supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ongoing'),
    supabase
      .from('shifts')
      .select(
        `
        driver_id,
        started_at,
        users!inner(full_name, email, role),
        vehicles:vehicle_id(plate)
      `
      )
      .is('ended_at', null)
      .eq('users.role', 'driver')
      .order('started_at', { ascending: false }),
    supabase
      .from('trips')
      .select(
        `
        id,
        created_at,
        total_amount,
        total_distance,
        status,
        start_zone,
        end_zone,
        start_stop,
        end_stop,
        users:driver_id(full_name),
        vehicles:vehicle_id(plate)
      `
      )
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const vehicleRows = vehicles ?? [];

  const onShiftRows = activeShiftsRaw ?? [];

  const plateByDriverFromVehicles = new Map<string, string>();
  vehicleRows.forEach((v) => {
      if (
        v.status === 'in_use' &&
        v.current_driver_id &&
        isDriverUser(v.users)
      ) {
        plateByDriverFromVehicles.set(v.current_driver_id, v.plate);
      }
    });

  const onShiftDrivers = onShiftRows.map((s) => {
    const user = pickJoinedUser(s.users);
    const vehicle = pickJoinedRecord(s.vehicles);
    return {
      name: user?.full_name?.trim() || user?.email || 'Sürücü',
      email: user?.email ?? '—',
      started_at: s.started_at,
      plate:
        vehicle?.plate ??
        plateByDriverFromVehicles.get(s.driver_id) ??
        null,
    };
  });

  const todayRows = tripsToday ?? [];
  const yesterdayRows = tripsYesterday ?? [];

  const activeBikes = vehicleRows.filter(
    (v) => v.status === 'in_use' && isDriverUser(v.users)
  ).length;

  const stats: DashboardStats = {
    activeBikes,
    onShift: onShiftDrivers.length,
    totalVehicles: vehicleRows.length,
    availableVehicles: vehicleRows.filter((v) => v.status === 'available').length,
    maintenanceVehicles: vehicleRows.filter((v) => v.status === 'maintenance')
      .length,
    ongoingTrips: ongoingTrips ?? 0,
    todayRevenue: todayRows.reduce(
      (s, r) => s + Number(r.total_amount),
      0
    ),
    todayKm: todayRows.reduce((s, r) => s + Number(r.total_distance), 0),
    todayRides: todayRows.length,
    yesterdayRevenue: yesterdayRows.reduce(
      (s, r) => s + Number(r.total_amount),
      0
    ),
    yesterdayKm: yesterdayRows.reduce(
      (s, r) => s + Number(r.total_distance),
      0
    ),
    yesterdayRides: yesterdayRows.length,
  };

  const activeVehicles: ActiveVehicle[] = vehicleRows
    .filter((v) => v.status === 'in_use' && isDriverUser(v.users))
    .map((v) => {
      const user = pickJoinedUser(v.users);
      return {
        plate: v.plate,
        label: v.label,
        driver_name: user?.full_name ?? null,
        driver_email: user?.email ?? null,
      };
    });

  const recentTrips: RecentTrip[] = (recentTripsRaw ?? []).map((t: any) => ({
    id: t.id,
    created_at: t.created_at,
    total_amount: Number(t.total_amount),
    total_distance: Number(t.total_distance),
    status: t.status,
    driver_name: t.users?.full_name ?? null,
    plate: t.vehicles?.plate ?? null,
    route_label: routeLabel(t),
  }));

  return (
    <DashboardClient
      stats={stats}
      activeVehicles={activeVehicles}
      onShiftDrivers={onShiftDrivers}
      recentTrips={recentTrips}
      adminName={adminName}
    />
  );
}
