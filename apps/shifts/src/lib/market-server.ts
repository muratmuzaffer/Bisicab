import { createClient } from '@supabase/supabase-js';
import {
  createLocalListing,
  createLocalOffer,
  deleteLocalListing,
  findLocalListing,
  listLocalListings,
  updateLocalListingStatus,
} from './local-market-store';
import { validateOffer } from './market-utils';
import type {
  CreateListingInput,
  CreateOfferInput,
  MarketListingStatus,
  ShiftMarketListing,
  ShiftMarketOffer,
} from './market-types';
import type { ShiftDuration } from './types';
import { namesMatch } from './utils';

const LISTINGS_TABLE = 'shift_market_listings';
const OFFERS_TABLE = 'shift_market_offers';

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function canUseLocalFallback(): boolean {
  return !process.env.VERCEL;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(error?.message ?? '')
  );
}

function migrationHint(): string {
  return 'Vardiya pazarı tabloları yok. Supabase’de 0018_shift_market.sql migration’ını çalıştırın.';
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapOffer(row: Record<string, unknown>): ShiftMarketOffer {
  return {
    id: row.id as string,
    listingId: row.listing_id as string,
    bidderName: row.bidder_name as string,
    amount: toNumber(row.amount),
    note: (row.note as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapListing(row: Record<string, unknown>): ShiftMarketListing {
  const offerRows = Array.isArray(row.shift_market_offers)
    ? (row.shift_market_offers as Record<string, unknown>[])
    : [];

  return {
    id: row.id as string,
    sellerName: row.seller_name as string,
    shiftDate: row.shift_date as string,
    slotLabel: (row.slot_label as string | null) ?? null,
    startTime: (row.start_time as string | null)?.slice(0, 5) ?? null,
    endTime: (row.end_time as string | null)?.slice(0, 5) ?? null,
    durationHours: (toNumber(row.duration_hours) === 4 ? 4 : 8) as ShiftDuration,
    minPrice: toNumber(row.min_price),
    note: (row.note as string | null) ?? null,
    status: (row.status as MarketListingStatus) ?? 'open',
    soldToName: (row.sold_to_name as string | null) ?? null,
    soldPrice: row.sold_price === null || row.sold_price === undefined ? null : toNumber(row.sold_price),
    createdAt: row.created_at as string,
    offers: offerRows.map(mapOffer),
  };
}

export async function fetchListings(limit = 100): Promise<ShiftMarketListing[]> {
  if (!isSupabaseConfigured()) {
    return listLocalListings(limit);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(LISTINGS_TABLE)
    .select('*, shift_market_offers(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (canUseLocalFallback()) return listLocalListings(limit);
    if (isMissingTableError(error)) return [];
    return [];
  }

  return (data ?? []).map((row) => mapListing(row as Record<string, unknown>));
}

async function fetchListingById(id: string): Promise<ShiftMarketListing | null> {
  if (!isSupabaseConfigured()) {
    return findLocalListing(id);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(LISTINGS_TABLE)
    .select('*, shift_market_offers(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationHint());
    if (canUseLocalFallback()) return findLocalListing(id);
    throw new Error(error.message ?? 'İlan okunamadı');
  }

  if (!data) {
    return canUseLocalFallback() ? findLocalListing(id) : null;
  }

  return mapListing(data as Record<string, unknown>);
}

export async function createListing(input: CreateListingInput): Promise<ShiftMarketListing> {
  const payload: CreateListingInput = {
    ...input,
    sellerName: input.sellerName.trim(),
    slotLabel: input.slotLabel?.trim() || null,
    note: input.note?.trim() || null,
    durationHours: input.durationHours ?? 8,
  };

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return createLocalListing(payload);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(LISTINGS_TABLE)
    .insert({
      seller_name: payload.sellerName,
      shift_date: payload.shiftDate,
      slot_label: payload.slotLabel,
      start_time: payload.startTime ?? null,
      end_time: payload.endTime ?? null,
      duration_hours: payload.durationHours,
      min_price: payload.minPrice,
      note: payload.note,
    })
    .select('*, shift_market_offers(*)')
    .single();

  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationHint());
    if (canUseLocalFallback()) return createLocalListing(payload);
    throw new Error(error.message ?? 'İlan kaydedilemedi');
  }

  return mapListing(data as Record<string, unknown>);
}

export async function createOffer(
  listingId: string,
  input: CreateOfferInput
): Promise<ShiftMarketListing> {
  const listing = await fetchListingById(listingId);
  if (!listing) throw new Error('İlan bulunamadı');

  const validationError = validateOffer(listing, input.bidderName, input.amount);
  if (validationError) throw new Error(validationError);

  const payload: CreateOfferInput = {
    bidderName: input.bidderName.trim(),
    amount: input.amount,
    note: input.note?.trim() || null,
  };

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return createLocalOffer(listingId, payload);
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from(OFFERS_TABLE).insert({
    listing_id: listingId,
    bidder_name: payload.bidderName,
    amount: payload.amount,
    note: payload.note,
  });

  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationHint());
    if (canUseLocalFallback()) return createLocalOffer(listingId, payload);
    throw new Error(error.message ?? 'Teklif kaydedilemedi');
  }

  const updated = await fetchListingById(listingId);
  if (!updated) throw new Error('İlan okunamadı');
  return updated;
}

export async function acceptOffer(
  listingId: string,
  offerId: string,
  actorName: string
): Promise<ShiftMarketListing> {
  const listing = await fetchListingById(listingId);
  if (!listing) throw new Error('İlan bulunamadı');
  if (!namesMatch(listing.sellerName, actorName)) {
    throw new Error('Teklifi yalnızca ilan sahibi kabul edebilir');
  }
  if (listing.status !== 'open') throw new Error('Bu ilan artık açık değil');

  const offer = listing.offers.find((item) => item.id === offerId);
  if (!offer) throw new Error('Teklif bulunamadı');

  const patch = {
    status: 'sold' as MarketListingStatus,
    soldToName: offer.bidderName,
    soldPrice: offer.amount,
  };

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return updateLocalListingStatus(listingId, patch);
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from(LISTINGS_TABLE)
    .update({
      status: patch.status,
      sold_to_name: patch.soldToName,
      sold_price: patch.soldPrice,
    })
    .eq('id', listingId);

  if (error) {
    if (canUseLocalFallback()) return updateLocalListingStatus(listingId, patch);
    throw new Error(error.message ?? 'Teklif kabul edilemedi');
  }

  const updated = await fetchListingById(listingId);
  if (!updated) throw new Error('İlan okunamadı');
  return updated;
}

export async function cancelListing(listingId: string, actorName: string): Promise<void> {
  const listing = await fetchListingById(listingId);
  if (!listing) throw new Error('İlan bulunamadı');
  if (!namesMatch(listing.sellerName, actorName)) {
    throw new Error('İlanı yalnızca sahibi kaldırabilir');
  }

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    await deleteLocalListing(listingId);
    return;
  }

  const supabase = getServiceClient();
  const { error } = await supabase.from(LISTINGS_TABLE).delete().eq('id', listingId);

  if (error) {
    if (canUseLocalFallback()) {
      await deleteLocalListing(listingId);
      return;
    }
    throw new Error(error.message ?? 'İlan kaldırılamadı');
  }
}
