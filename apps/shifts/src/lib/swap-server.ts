import { createClient } from '@supabase/supabase-js';
import { createSupabaseServer } from './supabase-server';
import {
  createLocalSwap,
  deleteLocalSwap,
  findLocalSwapById,
  findLocalSwapByMarketListingId,
  listLocalPendingCancelRequests,
  listLocalSwaps,
  rejectLocalSwapCancel,
  requestLocalSwapCancel,
} from './local-swap-store';
import type { ShiftMarketListing } from './market-types';
import {
  isMarketSwap,
  marketListingToSwapInput,
  normalizeCreateSwapInput,
  parseMarketListingIdFromNote,
  parseSwapShiftsJson,
} from './swap-utils';
import type { CreateShiftSwapInput, ShiftSwap, ShiftSwapSource, SwapShiftItem } from './types';

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function legacyFromShifts(
  requesterShifts: SwapShiftItem[],
  partnerShifts: SwapShiftItem[]
): Pick<ShiftSwap, 'requesterDate' | 'partnerDate' | 'requesterSlot' | 'partnerSlot'> {
  const firstGive = requesterShifts[0];
  const firstTake = partnerShifts[0];
  return {
    requesterDate: firstGive?.date ?? null,
    partnerDate: firstTake?.date ?? '',
    requesterSlot: firstGive?.slot ?? null,
    partnerSlot: firstTake?.slot ?? null,
  };
}

function mapRow(row: Record<string, unknown>): ShiftSwap {
  const parsedRequester = parseSwapShiftsJson(row.requester_shifts);
  const parsedPartner = parseSwapShiftsJson(row.partner_shifts);
  const legacy = legacyFromShifts(parsedRequester, parsedPartner);

  const requesterShifts =
    parsedRequester.length > 0
      ? parsedRequester
      : legacy.requesterDate
        ? [{ date: legacy.requesterDate, slot: legacy.requesterSlot ?? '', hours: 8 as const }]
        : [];

  const partnerShifts =
    parsedPartner.length > 0
      ? parsedPartner
      : legacy.partnerDate
        ? [{ date: legacy.partnerDate, slot: legacy.partnerSlot ?? '', hours: 4 as const }]
        : [];

  const note = (row.note as string | null) ?? null;
  const marketListingId =
    (row.market_listing_id as string | null | undefined) ??
    parseMarketListingIdFromNote(note);
  const rawSource = row.source as string | null | undefined;
  const source: ShiftSwapSource =
    rawSource === 'market' || Boolean(marketListingId) || Boolean(note?.startsWith('Pazar ·'))
      ? 'market'
      : 'swap';
  const soldPriceRaw = row.sold_price;
  const soldPrice =
    soldPriceRaw === null || soldPriceRaw === undefined
      ? null
      : Number(soldPriceRaw);

  return {
    id: row.id as string,
    requesterName: row.requester_name as string,
    partnerName: row.partner_name as string,
    requesterDate: legacy.requesterDate,
    partnerDate: legacy.partnerDate,
    requesterSlot: legacy.requesterSlot,
    partnerSlot: legacy.partnerSlot,
    requesterShifts,
    partnerShifts,
    note,
    createdAt: row.created_at as string,
    cancelRequestedAt: (row.cancel_requested_at as string | null) ?? null,
    cancelRequestedBy: (row.cancel_requested_by as string | null) ?? null,
    source,
    marketListingId: marketListingId ?? null,
    soldPrice: Number.isFinite(soldPrice) ? soldPrice : null,
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

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'PGRST204' || /could not find the .* column/i.test(error?.message ?? '');
}

function legacyInsertRow(payload: {
  requesterName: string;
  partnerName: string;
  requesterDate: string | null;
  partnerDate: string;
  requesterSlot: string | null;
  partnerSlot: string | null;
  note: string | null;
}) {
  return {
    requester_name: payload.requesterName,
    partner_name: payload.partnerName,
    requester_date: payload.requesterDate,
    partner_date: payload.partnerDate,
    requester_slot: payload.requesterSlot,
    partner_slot: payload.partnerSlot,
    note: payload.note,
  };
}

function fullInsertRow(payload: {
  requesterName: string;
  partnerName: string;
  requesterDate: string | null;
  partnerDate: string;
  requesterSlot: string | null;
  partnerSlot: string | null;
  requesterShifts: SwapShiftItem[];
  partnerShifts: SwapShiftItem[];
  note: string | null;
  source?: ShiftSwapSource;
  marketListingId?: string | null;
  soldPrice?: number | null;
}) {
  return {
    ...legacyInsertRow(payload),
    requester_shifts: payload.requesterShifts,
    partner_shifts: payload.partnerShifts,
    source: payload.source ?? 'swap',
    market_listing_id: payload.marketListingId ?? null,
    sold_price: payload.soldPrice ?? null,
  };
}

function canUseLocalFallback(): boolean {
  return !process.env.VERCEL;
}

export async function createSwap(input: CreateShiftSwapInput): Promise<ShiftSwap> {
  const { requesterShifts, partnerShifts, oneWay } = normalizeCreateSwapInput(input);
  const legacy = legacyFromShifts(requesterShifts, partnerShifts);
  const source: ShiftSwapSource =
    input.source === 'market' || Boolean(input.marketListingId) ? 'market' : 'swap';

  const payload = {
    requesterName: input.requesterName.trim(),
    partnerName: input.partnerName.trim(),
    requesterDate: legacy.requesterDate,
    partnerDate: legacy.partnerDate,
    requesterSlot: legacy.requesterSlot,
    partnerSlot: legacy.partnerSlot,
    requesterShifts,
    partnerShifts,
    note: input.note?.trim() ?? null,
    oneWay,
    source,
    marketListingId: input.marketListingId?.trim() || null,
    soldPrice: input.soldPrice ?? null,
  };

  if (!payload.partnerDate) {
    throw new Error('Alınacak vardiya tarihi gerekli');
  }

  if (payload.marketListingId) {
    const existing = await findSwapByMarketListingId(payload.marketListingId);
    if (existing) return existing;
  }

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) {
      throw new Error('Supabase yapılandırılmamış');
    }
    return createLocalSwap(payload);
  }

  const supabase = getServiceClient();
  const fullRow = fullInsertRow(payload);
  let { data, error } = await supabase.from('shift_swaps').insert(fullRow).select('*').single();

  if (error && isMissingColumnError(error)) {
    // source / market kolonları yoksa çoklu vardiya satırı ile dene
    const withoutMarket = {
      ...legacyInsertRow(payload),
      requester_shifts: payload.requesterShifts,
      partner_shifts: payload.partnerShifts,
    };
    const retry = await supabase.from('shift_swaps').insert(withoutMarket).select('*').single();
    data = retry.data;
    error = retry.error;

    if (error && isMissingColumnError(error)) {
      const multi =
        payload.requesterShifts.length > 1 ||
        payload.partnerShifts.length > 1 ||
        payload.requesterShifts.some((s) => s.date !== payload.requesterDate) ||
        payload.partnerShifts.some((s) => s.date !== payload.partnerDate);
      if (multi) {
        throw new Error(
          'Veritabanı çoklu vardiya değişimini desteklemiyor. Supabase’de 0015_shift_swaps_multi.sql migration’ını çalıştırın.'
        );
      }

      const legacyRow = legacyInsertRow(payload);
      const legacyResult = await supabase.from('shift_swaps').insert(legacyRow).select('*').single();
      if (legacyResult.error) {
        throw new Error(legacyResult.error.message ?? 'Vardiya değişimi kaydedilemedi');
      }
      if (legacyResult.data) {
        return {
          ...mapRow(legacyResult.data),
          source: payload.source,
          marketListingId: payload.marketListingId,
          soldPrice: payload.soldPrice,
        };
      }
    } else if (!error && data) {
      return {
        ...mapRow(data),
        source: payload.source,
        marketListingId: payload.marketListingId,
        soldPrice: payload.soldPrice,
      };
    }
  }

  if (!error && data) return mapRow(data);

  if (error) {
    if (error.code === '23505' && payload.marketListingId) {
      const existing = await findSwapByMarketListingId(payload.marketListingId);
      if (existing) return existing;
    }
    if (error.code === '42P01') {
      throw new Error(
        'shift_swaps tablosu bulunamadı. Supabase’de 0012_shift_swaps.sql migration’ını çalıştırın.'
      );
    }
    throw new Error(error.message ?? 'Vardiya değişimi kaydedilemedi');
  }

  if (canUseLocalFallback()) {
    return createLocalSwap(payload);
  }

  throw new Error('Vardiya değişimi kaydedilemedi');
}

export async function findSwapByMarketListingId(listingId: string): Promise<ShiftSwap | null> {
  if (!listingId.trim()) return null;

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) return null;
    return findLocalSwapByMarketListingId(listingId);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('shift_swaps')
    .select('*')
    .eq('market_listing_id', listingId)
    .maybeSingle();

  if (!error && data) return mapRow(data);

  if (error && isMissingColumnError(error) && canUseLocalFallback()) {
    return findLocalSwapByMarketListingId(listingId);
  }

  // Kolon yoksa note içinden ara
  if (error && isMissingColumnError(error)) {
    const swaps = await fetchSwaps(200);
    return swaps.find((s) => s.marketListingId === listingId) ?? null;
  }

  if (canUseLocalFallback()) return findLocalSwapByMarketListingId(listingId);
  return null;
}

export async function fetchSwapById(id: string): Promise<ShiftSwap | null> {
  if (!id.trim()) return null;

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) return null;
    return findLocalSwapById(id);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase.from('shift_swaps').select('*').eq('id', id).maybeSingle();
  if (!error && data) return mapRow(data);
  if (canUseLocalFallback()) return findLocalSwapById(id);
  return null;
}

/** Satılan pazar ilanını değişim geçmişine yazar (idempotent). */
export async function recordMarketSaleAsSwap(
  listing: ShiftMarketListing
): Promise<ShiftSwap | null> {
  const input = marketListingToSwapInput(listing);
  if (!input) return null;
  try {
    return await createSwap(input);
  } catch (err) {
    console.error('Pazar satışı değişim kaydı oluşturulamadı:', err);
    return null;
  }
}

export async function deleteSwap(id: string): Promise<void> {
  if (!id.trim()) throw new Error('Geçersiz kayıt');

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) {
      throw new Error('Supabase yapılandırılmamış');
    }
    await deleteLocalSwap(id);
    return;
  }

  const supabase = getServiceClient();
  const { error, count } = await supabase
    .from('shift_swaps')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw new Error(error.message ?? 'Değişim iptal edilemedi');
  if (count === 0 && canUseLocalFallback()) {
    await deleteLocalSwap(id);
    return;
  }
  if (count === 0) throw new Error('Değişim kaydı bulunamadı');
}

function assertCanRequestCancel(swap: ShiftSwap): void {
  if (swap.cancelRequestedAt) {
    throw new Error('Bu değişim için zaten iptal talebi gönderildi');
  }
}

export async function requestSwapCancel(swapId: string, requestedBy?: string): Promise<ShiftSwap> {
  const requesterLabel = requestedBy?.trim() || 'Belirtilmedi';
  if (!swapId.trim()) throw new Error('Geçersiz kayıt');

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    const swaps = await listLocalSwaps(500);
    const swap = swaps.find((s) => s.id === swapId);
    if (!swap) throw new Error('Değişim kaydı bulunamadı');
    assertCanRequestCancel(swap);
    return requestLocalSwapCancel(swapId, requesterLabel);
  }

  const supabase = getServiceClient();
  const { data: row, error: fetchError } = await supabase
    .from('shift_swaps')
    .select('*')
    .eq('id', swapId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message ?? 'Kayıt okunamadı');
  if (!row) {
    if (canUseLocalFallback()) {
      const swaps = await listLocalSwaps(500);
      const swap = swaps.find((s) => s.id === swapId);
      if (!swap) throw new Error('Değişim kaydı bulunamadı');
      assertCanRequestCancel(swap);
      return requestLocalSwapCancel(swapId, requesterLabel);
    }
    throw new Error('Değişim kaydı bulunamadı');
  }

  const swap = mapRow(row);
  assertCanRequestCancel(swap);

  const { data, error } = await supabase
    .from('shift_swaps')
    .update({
      cancel_requested_at: new Date().toISOString(),
      cancel_requested_by: requesterLabel,
    })
    .eq('id', swapId)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error(
        'İptal talebi desteklenmiyor. Supabase’de 0019_shift_swaps_cancel_update.sql migration’ını çalıştırın.'
      );
    }
    if (/row-level security|RLS/i.test(error.message ?? '')) {
      throw new Error(
        'İptal talebi kaydedilemedi (yetki). Supabase’de 0019_shift_swaps_cancel_update.sql migration’ını çalıştırın.'
      );
    }
    throw new Error(error.message ?? 'İptal talebi gönderilemedi');
  }

  if (!data) {
    throw new Error(
      'İptal talebi kaydedilemedi. Supabase’de 0019_shift_swaps_cancel_update.sql migration’ını çalıştırın.'
    );
  }

  return mapRow(data);
}

export async function fetchPendingCancelRequests(limit = 50): Promise<ShiftSwap[]> {
  if (!isSupabaseConfigured()) {
    return listLocalPendingCancelRequests(limit);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('shift_swaps')
    .select('*')
    .not('cancel_requested_at', 'is', null)
    .order('cancel_requested_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingColumnError(error)) {
      if (canUseLocalFallback()) return listLocalPendingCancelRequests(limit);
      throw new Error(
        'İptal talebi kolonları yok. Supabase’de 0019_shift_swaps_cancel_update.sql çalıştırın.'
      );
    }
    if (canUseLocalFallback()) return listLocalPendingCancelRequests(limit);
    throw new Error(error.message ?? 'İptal talepleri okunamadı');
  }

  return (data ?? []).map(mapRow);
}

export async function approveSwapCancel(swapId: string): Promise<void> {
  const swap = await fetchSwapById(swapId);
  await deleteSwap(swapId);

  if (swap && isMarketSwap(swap)) {
    const listingId = swap.marketListingId ?? parseMarketListingIdFromNote(swap.note);
    if (listingId) {
      const { revertMarketSale } = await import('./market-server');
      await revertMarketSale(listingId);
    }
  }
}

export async function rejectSwapCancel(swapId: string): Promise<ShiftSwap> {
  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return rejectLocalSwapCancel(swapId);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('shift_swaps')
    .update({
      cancel_requested_at: null,
      cancel_requested_by: null,
    })
    .eq('id', swapId)
    .select('*')
    .single();

  if (error) {
    if (canUseLocalFallback()) return rejectLocalSwapCancel(swapId);
    throw new Error(error.message ?? 'Talep reddedilemedi');
  }

  return mapRow(data);
}

export async function fetchDriverNamesForMonth(year: number, month: number): Promise<string[]> {
  const { fetchScheduleWithSwaps } = await import('./supabase-server');
  const schedule = await fetchScheduleWithSwaps(year, month);
  if (!schedule) return [];
  const names = new Set<string>();
  schedule.entries.forEach((e) => names.add(e.driverName));
  return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
}
