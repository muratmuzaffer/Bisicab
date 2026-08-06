import { createClient } from '@supabase/supabase-js';
import {
  createLocalListing,
  createLocalOffer,
  deleteLocalListing,
  findLocalListing,
  listLocalListings,
  resolveLocalExpiredListings,
  updateLocalListing,
  updateLocalListingStatus,
} from './local-market-store';
import {
  isListingExpired,
  lastOffer,
  normalizeIban,
  validateListingInput,
  validateOffer,
} from './market-utils';
import type {
  CreateListingInput,
  CreateOfferInput,
  MarketListingStatus,
  ShiftMarketListing,
  ShiftMarketOffer,
  UpdateListingInput,
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

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === 'PGRST204' || /could not find the .* column/i.test(error?.message ?? '');
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
    iban: normalizeIban((row.iban as string | null) ?? null) || null,
    note: (row.note as string | null) ?? null,
    status: (row.status as MarketListingStatus) ?? 'open',
    soldToName: (row.sold_to_name as string | null) ?? null,
    soldPrice: row.sold_price === null || row.sold_price === undefined ? null : toNumber(row.sold_price),
    createdAt: row.created_at as string,
    offers: offerRows.map(mapOffer),
  };
}

function expiryPatch(
  listing: ShiftMarketListing
): Partial<Pick<ShiftMarketListing, 'status' | 'soldToName' | 'soldPrice'>> | null {
  if (listing.status !== 'open' || !isListingExpired(listing)) return null;
  const winner = lastOffer(listing.offers);
  if (winner) {
    return {
      status: 'sold',
      soldToName: winner.bidderName,
      soldPrice: winner.amount,
    };
  }
  return { status: 'cancelled', soldToName: null, soldPrice: null };
}

/** Süresi dolan açık ilanları kapatır: son teklif veren alır; teklif yoksa iptal. */
async function resolveExpiredListings(
  listings: ShiftMarketListing[]
): Promise<ShiftMarketListing[]> {
  const due = listings.filter((listing) => expiryPatch(listing));
  if (due.length === 0) return listings;

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) return listings;
    const before = new Map(listings.map((l) => [l.id, l.status]));
    const resolved = await resolveLocalExpiredListings(expiryPatch);
    const soldNow = resolved.filter(
      (listing) => listing.status === 'sold' && before.get(listing.id) === 'open'
    );
    if (soldNow.length > 0) {
      const { recordMarketSaleAsSwap } = await import('./swap-server');
      await Promise.all(soldNow.map((listing) => recordMarketSaleAsSwap(listing)));
    }
    return resolved
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, listings.length);
  }

  const supabase = getServiceClient();
  const soldNow: ShiftMarketListing[] = [];
  await Promise.all(
    due.map(async (listing) => {
      const patch = expiryPatch(listing);
      if (!patch) return;
      await supabase
        .from(LISTINGS_TABLE)
        .update({
          status: patch.status,
          sold_to_name: patch.soldToName ?? null,
          sold_price: patch.soldPrice ?? null,
        })
        .eq('id', listing.id)
        .eq('status', 'open');
      if (patch.status === 'sold') {
        soldNow.push({ ...listing, ...patch });
      }
    })
  );

  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  for (const listing of due) {
    const patch = expiryPatch(listing);
    if (!patch) continue;
    byId.set(listing.id, { ...listing, ...patch });
  }

  if (soldNow.length > 0) {
    const { recordMarketSaleAsSwap } = await import('./swap-server');
    await Promise.all(soldNow.map((listing) => recordMarketSaleAsSwap(listing)));
  }

  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function fetchListings(limit = 100): Promise<ShiftMarketListing[]> {
  if (!isSupabaseConfigured()) {
    const local = await listLocalListings(limit);
    return resolveExpiredListings(local);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(LISTINGS_TABLE)
    .select('*, shift_market_offers(*)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (canUseLocalFallback()) {
      const local = await listLocalListings(limit);
      return resolveExpiredListings(local);
    }
    if (isMissingTableError(error)) return [];
    return [];
  }

  const listings = (data ?? []).map((row) => mapListing(row as Record<string, unknown>));
  return resolveExpiredListings(listings);
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
    iban: normalizeIban(input.iban) || null,
    durationHours: input.durationHours ?? 8,
  };

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return createLocalListing(payload);
  }

  const supabase = getServiceClient();
  const insertRow = {
    seller_name: payload.sellerName,
    shift_date: payload.shiftDate,
    slot_label: payload.slotLabel,
    start_time: payload.startTime ?? null,
    end_time: payload.endTime ?? null,
    duration_hours: payload.durationHours,
    min_price: payload.minPrice,
    iban: payload.iban,
    note: payload.note,
  };

  let { data, error } = await supabase
    .from(LISTINGS_TABLE)
    .insert(insertRow)
    .select('*, shift_market_offers(*)')
    .single();

  if (error && isMissingColumnError(error)) {
    const { iban: _iban, ...withoutIban } = insertRow;
    const retry = await supabase
      .from(LISTINGS_TABLE)
      .insert(withoutIban)
      .select('*, shift_market_offers(*)')
      .single();
    data = retry.data;
    error = retry.error;
    if (!error && data) {
      return { ...mapListing(data as Record<string, unknown>), iban: payload.iban ?? null };
    }
  }

  if (error) {
    if (isMissingTableError(error)) throw new Error(migrationHint());
    if (canUseLocalFallback()) return createLocalListing(payload);
    throw new Error(error.message ?? 'İlan kaydedilemedi');
  }

  return mapListing(data as Record<string, unknown>);
}

async function persistListingPatch(
  listingId: string,
  patch: Partial<Pick<ShiftMarketListing, 'status' | 'soldToName' | 'soldPrice'>>
): Promise<ShiftMarketListing> {
  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return updateLocalListingStatus(listingId, patch);
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from(LISTINGS_TABLE)
    .update({
      status: patch.status,
      sold_to_name: patch.soldToName ?? null,
      sold_price: patch.soldPrice ?? null,
    })
    .eq('id', listingId);

  if (error) {
    if (canUseLocalFallback()) return updateLocalListingStatus(listingId, patch);
    throw new Error(error.message ?? 'İlan güncellenemedi');
  }

  const updated = await fetchListingById(listingId);
  if (!updated) throw new Error('İlan okunamadı');
  return updated;
}

export async function createOffer(
  listingId: string,
  input: CreateOfferInput
): Promise<ShiftMarketListing> {
  let listing = await fetchListingById(listingId);
  if (!listing) throw new Error('İlan bulunamadı');

  const expired = expiryPatch(listing);
  if (expired) {
    listing = await persistListingPatch(listingId, expired);
    throw new Error('İlan süresi doldu — vardiya saati geçti');
  }

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

  const sold = await persistListingPatch(listingId, {
    status: 'sold' as MarketListingStatus,
    soldToName: offer.bidderName,
    soldPrice: offer.amount,
  });

  const { recordMarketSaleAsSwap } = await import('./swap-server');
  await recordMarketSaleAsSwap(sold);
  return sold;
}

/** İptal onayında pazar satışını geri al — çizelge eski haline döner. */
export async function revertMarketSale(listingId: string): Promise<void> {
  const listing = await fetchListingById(listingId);
  if (!listing) return;
  if (listing.status !== 'sold') return;

  await persistListingPatch(listingId, {
    status: 'cancelled' as MarketListingStatus,
    soldToName: null,
    soldPrice: null,
  });
}

export async function updateListingDetails(
  listingId: string,
  input: UpdateListingInput
): Promise<ShiftMarketListing> {
  const listing = await fetchListingById(listingId);
  if (!listing) throw new Error('İlan bulunamadı');
  if (!namesMatch(listing.sellerName, input.actorName)) {
    throw new Error('İlanı yalnızca sahibi düzenleyebilir');
  }
  if (listing.status !== 'open') {
    throw new Error('Yalnızca açık ilanlar düzenlenebilir');
  }

  const next = {
    shiftDate: input.shiftDate?.trim() || listing.shiftDate,
    slotLabel:
      input.slotLabel !== undefined ? input.slotLabel?.trim() || null : listing.slotLabel,
    startTime: input.startTime !== undefined ? input.startTime : listing.startTime,
    endTime: input.endTime !== undefined ? input.endTime : listing.endTime,
    durationHours:
      input.durationHours === 4 || input.durationHours === 8
        ? input.durationHours
        : listing.durationHours,
    minPrice:
      input.minPrice !== undefined && Number.isFinite(input.minPrice)
        ? Number(input.minPrice)
        : listing.minPrice,
    iban:
      input.iban !== undefined
        ? normalizeIban(input.iban) || null
        : listing.iban,
    note: input.note !== undefined ? input.note?.trim() || null : listing.note,
  };

  const validationError = validateListingInput({
    sellerName: listing.sellerName,
    shiftDate: next.shiftDate,
    startTime: next.startTime,
    minPrice: next.minPrice,
    iban: next.iban,
  });
  if (validationError) throw new Error(validationError);

  if (listing.offers.length > 0) {
    const lowestOffer = Math.min(...listing.offers.map((offer) => offer.amount));
    if (next.minPrice > lowestOffer) {
      throw new Error(
        `Taban fiyat mevcut tekliflerin üstünde olamaz (en düşük teklif: ${lowestOffer} ₺)`
      );
    }
  }

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return updateLocalListing(listingId, next);
  }

  const supabase = getServiceClient();
  const updateRow = {
    shift_date: next.shiftDate,
    slot_label: next.slotLabel,
    start_time: next.startTime,
    end_time: next.endTime,
    duration_hours: next.durationHours,
    min_price: next.minPrice,
    iban: next.iban,
    note: next.note,
  };

  let { error } = await supabase.from(LISTINGS_TABLE).update(updateRow).eq('id', listingId);

  if (error && isMissingColumnError(error)) {
    const { iban: _iban, ...withoutIban } = updateRow;
    const retry = await supabase.from(LISTINGS_TABLE).update(withoutIban).eq('id', listingId);
    error = retry.error;
  }

  if (error) {
    if (canUseLocalFallback()) return updateLocalListing(listingId, next);
    throw new Error(error.message ?? 'İlan güncellenemedi');
  }

  const updated = await fetchListingById(listingId);
  if (!updated) throw new Error('İlan okunamadı');
  return { ...updated, iban: next.iban ?? updated.iban };
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
