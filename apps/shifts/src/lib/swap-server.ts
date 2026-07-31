import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from './supabase-server';
import { createLocalSwap, listLocalSwaps } from './local-swap-store';
import type { CreateShiftSwapInput, ShiftSwap } from './types';

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function mapRow(row: Record<string, unknown>): ShiftSwap {
  return {
    id: row.id as string,
    requesterName: row.requester_name as string,
    partnerName: row.partner_name as string,
    requesterDate: row.requester_date as string,
    partnerDate: row.partner_date as string,
    requesterSlot: (row.requester_slot as string | null) ?? null,
    partnerSlot: (row.partner_slot as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function fetchSwaps(limit = 100): Promise<ShiftSwap[]> {
  if (!isSupabaseConfigured()) {
    return listLocalSwaps(limit);
  }

  try {
    const supabase = createSupabaseServer();
    const { data, error } = await supabase
      .from('shift_swaps')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (data && data.length > 0) return data.map(mapRow);
  } catch {
    /* fallback */
  }

  return listLocalSwaps(limit);
}

export async function createSwap(input: CreateShiftSwapInput): Promise<ShiftSwap> {
  if (!isSupabaseConfigured()) {
    return createLocalSwap(input);
  }

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from('shift_swaps')
      .insert({
        requester_name: input.requesterName.trim(),
        partner_name: input.partnerName.trim(),
        requester_date: input.requesterDate,
        partner_date: input.partnerDate,
        requester_slot: input.requesterSlot ?? null,
        partner_slot: input.partnerSlot ?? null,
        note: input.note?.trim() ?? null,
      })
      .select('*')
      .single();

    if (error) throw error;
    if (data) return mapRow(data);
  } catch {
    /* fallback */
  }

  return createLocalSwap(input);
}

export async function fetchDriverNamesForMonth(year: number, month: number): Promise<string[]> {
  const { fetchSchedule } = await import('./supabase-server');
  const schedule = await fetchSchedule(year, month);
  if (!schedule) return [];
  const names = new Set<string>();
  schedule.entries.forEach((e) => names.add(e.driverName));
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
}
