import { createSupabaseServer } from '@/lib/supabase-server';
import { VehiclesClient, type VehicleRow } from '@/components/vehicles-client';

export const dynamic = 'force-dynamic';

function driverFromUser(u: {
  full_name?: string | null;
  email?: string | null;
} | null): { name: string | null; email: string | null } {
  if (!u) return { name: null, email: null };
  return {
    name: u.full_name?.trim() || u.email || null,
    email: u.email ?? null,
  };
}

export default async function VehiclesPage() {
  const supabase = createSupabaseServer();

  const [{ data: vehicles }, { data: assignments }] = await Promise.all([
    supabase
      .from('vehicles')
      .select(
        'id, plate, label, status, updated_at, current_driver_id, users:current_driver_id(full_name, email, role)'
      )
      .order('plate'),
    supabase
      .from('vehicle_assignments')
      .select(
        `
        vehicle_id,
        assigned_at,
        users:driver_id(full_name, email, role)
      `
      )
      .is('released_at', null)
      .order('assigned_at', { ascending: false }),
  ]);

  const driverByVehicle = new Map<
    string,
    { name: string | null; email: string | null }
  >();

  for (const row of assignments ?? []) {
    const vehicleId = row.vehicle_id as string;
    if (driverByVehicle.has(vehicleId)) continue;
    const u = row.users as {
      full_name?: string | null;
      email?: string | null;
      role?: string;
    } | null;
    if (u?.role && u.role !== 'driver') continue;
    driverByVehicle.set(vehicleId, driverFromUser(u));
  }

  const vehicleRows: VehicleRow[] = (vehicles ?? []).map((v: any) => {
    const fromAssignment = driverByVehicle.get(v.id);
    const fromVehicle =
      v.status === 'in_use' && v.users?.role === 'driver'
        ? driverFromUser(v.users)
        : v.status === 'in_use' && v.users
          ? driverFromUser(v.users)
          : null;

    const driver = fromAssignment?.name || fromAssignment?.email
      ? fromAssignment
      : fromVehicle;

    return {
      id: v.id,
      plate: v.plate,
      label: v.label,
      status: v.status,
      driver_name: driver?.name ?? null,
      driver_email: driver?.email ?? null,
      updated_at: v.updated_at,
    };
  });

  return <VehiclesClient vehicles={vehicleRows} />;
}
