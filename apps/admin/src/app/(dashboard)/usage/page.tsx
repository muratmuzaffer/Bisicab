import { createSupabaseServer } from '@/lib/supabase-server';
import { UsageClient, type UsageRow } from '@/components/usage-client';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const supabase = createSupabaseServer();

  const [{ data: assignments }, { data: vehicles }] = await Promise.all([
    supabase
      .from('vehicle_assignments')
      .select(
        `
        id,
        vehicle_id,
        assigned_at,
        released_at,
        release_reason,
        users:driver_id(full_name, email),
        vehicles:vehicle_id(plate, label),
        shifts:shift_id(started_at, planned_end_at, planned_duration_hours, ended_at)
      `
      )
      .order('assigned_at', { ascending: false })
      .limit(500),
    supabase.from('vehicles').select('id, plate, label').order('plate'),
  ]);

  const rows: UsageRow[] = (assignments ?? []).map((r: any) => ({
    id: r.id,
    vehicle_id: r.vehicle_id,
    driver_name: r.users?.full_name ?? null,
    driver_email: r.users?.email ?? '—',
    plate: r.vehicles?.plate ?? '—',
    vehicle_label: r.vehicles?.label ?? null,
    shift_started_at: r.shifts?.started_at ?? r.assigned_at,
    shift_planned_end_at: r.shifts?.planned_end_at ?? null,
    shift_duration_hours: r.shifts?.planned_duration_hours ?? null,
    assigned_at: r.assigned_at,
    released_at: r.released_at,
    release_reason: r.release_reason,
    is_active: !r.released_at,
  }));

  return (
    <UsageClient
      rows={rows}
      vehicles={(vehicles ?? []).map((v) => ({
        id: v.id,
        plate: v.plate,
        label: v.label,
      }))}
    />
  );
}
