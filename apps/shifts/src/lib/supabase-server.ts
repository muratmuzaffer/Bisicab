import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ScheduleData, ShiftScheduleEntry, ShiftScheduleMonth } from './types';
import { listLocalMonths, loadLocalSchedule } from './local-schedule-store';
import { dedupeScheduleEntries } from './dedupe';

function mapMonth(row: Record<string, unknown>): ShiftScheduleMonth {
  return {
    id: row.id as string,
    year: row.year as number,
    month: row.month as number,
    title: (row.title as string | null) ?? null,
    pdfUrl: (row.pdf_url as string | null) ?? null,
    pdfFilename: (row.pdf_filename as string | null) ?? null,
    published: row.published as boolean,
  };
}

function mapEntry(row: Record<string, unknown>): ShiftScheduleEntry {
  return {
    id: row.id as string,
    scheduleMonthId: row.schedule_month_id as string,
    driverName: row.driver_name as string,
    shiftDate: row.shift_date as string,
    startTime: (row.start_time as string | null)?.slice(0, 5) ?? null,
    endTime: (row.end_time as string | null)?.slice(0, 5) ?? null,
    durationHours: row.duration_hours as 4 | 8,
    slotLabel: (row.slot_label as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  };
}

export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* server component */
          }
        },
      },
    }
  );
}

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export async function fetchSchedule(year: number, month: number): Promise<ScheduleData | null> {
  const local = await loadLocalSchedule(year, month);
  if (local) {
    return { ...local, entries: dedupeScheduleEntries(local.entries) };
  }

  if (!isSupabaseConfigured()) return null;

  const supabase = createSupabaseServer();

  const { data: monthRow } = await supabase
    .from('shift_schedule_months')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .eq('published', true)
    .maybeSingle();

  if (!monthRow) return null;

  const { data: entries } = await supabase
    .from('shift_schedule_entries')
    .select('*')
    .eq('schedule_month_id', monthRow.id)
    .order('shift_date')
    .order('start_time');

  return {
    month: mapMonth(monthRow),
    entries: dedupeScheduleEntries((entries ?? []).map(mapEntry)),
  };
}

export async function fetchAvailableMonths(): Promise<Array<{ year: number; month: number }>> {
  const local = await listLocalMonths();
  if (local.length > 0) return local;

  if (!isSupabaseConfigured()) return [];

  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('shift_schedule_months')
    .select('year, month')
    .eq('published', true)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  return data ?? [];
}

export async function fetchAllDriverNames(year: number, month: number): Promise<string[]> {
  const schedule = await fetchSchedule(year, month);
  if (!schedule) return [];

  const names = new Set<string>();
  schedule.entries.forEach((e) => names.add(e.driverName));
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
}
