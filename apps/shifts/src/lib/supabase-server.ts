import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { ScheduleData, ShiftScheduleEntry, ShiftScheduleMonth } from './types';
import { listLocalMonths, loadLocalSchedule } from './local-schedule-store';
import { dedupeScheduleEntries } from './dedupe';
import { normalizeShiftTimes } from './shift-styles';
import { applySwapsToEntries, swapsForMonth } from './swap-utils';

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
  return normalizeShiftTimes({
    id: row.id as string,
    scheduleMonthId: row.schedule_month_id as string,
    driverName: row.driver_name as string,
    shiftDate: row.shift_date as string,
    startTime: (row.start_time as string | null)?.slice(0, 5) ?? null,
    endTime: (row.end_time as string | null)?.slice(0, 5) ?? null,
    durationHours: row.duration_hours as 4 | 8,
    slotLabel: (row.slot_label as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
  });
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

function useRemoteStorageFirst(): boolean {
  return Boolean(process.env.VERCEL);
}

async function fetchScheduleFromSupabase(year: number, month: number): Promise<ScheduleData | null> {
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

export async function fetchSchedule(year: number, month: number): Promise<ScheduleData | null> {
  if (useRemoteStorageFirst() && isSupabaseConfigured()) {
    const remote = await fetchScheduleFromSupabase(year, month);
    if (remote) return remote;
  }

  const local = await loadLocalSchedule(year, month);
  if (local) {
    return { ...local, entries: dedupeScheduleEntries(local.entries) };
  }

  if (!useRemoteStorageFirst() && isSupabaseConfigured()) {
    return fetchScheduleFromSupabase(year, month);
  }

  return null;
}

export async function fetchScheduleWithSwaps(
  year: number,
  month: number
): Promise<ScheduleData | null> {
  const schedule = await fetchSchedule(year, month);
  if (!schedule) return null;

  const { fetchSwaps } = await import('./swap-server');
  const swaps = await fetchSwaps(200);
  const monthSwaps = swapsForMonth(swaps, year, month);
  let entries =
    monthSwaps.length > 0
      ? applySwapsToEntries(schedule.entries, monthSwaps)
      : schedule.entries;

  try {
    const { fetchListings } = await import('./market-server');
    const { applyMarketSalesToEntries, marketSalesForMonth } = await import('./market-utils');
    const sales = marketSalesForMonth(await fetchListings(200), year, month);
    if (sales.length > 0) {
      entries = applyMarketSalesToEntries(entries, sales);
    }
  } catch {
    /* pazar tabloları yoksa çizelge yine çalışsın */
  }

  if (entries === schedule.entries) return schedule;
  return { ...schedule, entries };
}

export async function fetchAvailableMonths(): Promise<Array<{ year: number; month: number }>> {
  const merged = new Map<string, { year: number; month: number }>();

  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServer();
    const { data } = await supabase
      .from('shift_schedule_months')
      .select('year, month')
      .eq('published', true)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    for (const row of data ?? []) {
      merged.set(`${row.year}-${row.month}`, row);
    }
  }

  if (!useRemoteStorageFirst()) {
    for (const row of await listLocalMonths()) {
      merged.set(`${row.year}-${row.month}`, row);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.year - a.year || b.month - a.month);
}

export async function fetchAllDriverNames(year: number, month: number): Promise<string[]> {
  const schedule = await fetchSchedule(year, month);
  if (!schedule) return [];

  const names = new Set<string>();
  schedule.entries.forEach((e) => names.add(e.driverName));
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
}
