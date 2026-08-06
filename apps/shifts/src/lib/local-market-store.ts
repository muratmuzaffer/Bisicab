import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type {
  CreateListingInput,
  CreateOfferInput,
  ShiftMarketListing,
  ShiftMarketOffer,
} from './market-types';
import { normalizeIban } from './market-utils';

const LISTINGS_FILE = path.join(process.cwd(), 'data', 'market.json');

async function ensureFile() {
  await fs.mkdir(path.dirname(LISTINGS_FILE), { recursive: true });
  try {
    await fs.access(LISTINGS_FILE);
  } catch {
    await fs.writeFile(LISTINGS_FILE, '[]', 'utf-8');
  }
}

async function readAll(): Promise<ShiftMarketListing[]> {
  await ensureFile();
  const raw = await fs.readFile(LISTINGS_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as ShiftMarketListing[];
  return parsed.map((listing) => ({
    ...listing,
    iban: normalizeIban(listing.iban) || null,
    offers: listing.offers ?? [],
  }));
}

async function writeAll(listings: ShiftMarketListing[]) {
  await ensureFile();
  await fs.writeFile(LISTINGS_FILE, JSON.stringify(listings, null, 2), 'utf-8');
}

export async function listLocalListings(limit = 100): Promise<ShiftMarketListing[]> {
  const listings = await readAll();
  return listings
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function createLocalListing(
  input: CreateListingInput
): Promise<ShiftMarketListing> {
  const listings = await readAll();
  const listing: ShiftMarketListing = {
    id: randomUUID(),
    sellerName: input.sellerName.trim(),
    shiftDate: input.shiftDate,
    slotLabel: input.slotLabel?.trim() || null,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    durationHours: input.durationHours ?? 8,
    minPrice: input.minPrice,
    iban: normalizeIban(input.iban) || null,
    note: input.note?.trim() || null,
    status: 'open',
    soldToName: null,
    soldPrice: null,
    createdAt: new Date().toISOString(),
    offers: [],
  };
  listings.unshift(listing);
  await writeAll(listings);
  return listing;
}

export async function findLocalListing(id: string): Promise<ShiftMarketListing | null> {
  const listings = await readAll();
  return listings.find((listing) => listing.id === id) ?? null;
}

export async function createLocalOffer(
  listingId: string,
  input: CreateOfferInput
): Promise<ShiftMarketListing> {
  const listings = await readAll();
  const index = listings.findIndex((listing) => listing.id === listingId);
  if (index < 0) throw new Error('İlan bulunamadı');

  const offer: ShiftMarketOffer = {
    id: randomUUID(),
    listingId,
    bidderName: input.bidderName.trim(),
    amount: input.amount,
    note: input.note?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  listings[index] = {
    ...listings[index]!,
    offers: [...listings[index]!.offers, offer],
  };
  await writeAll(listings);
  return listings[index]!;
}

export async function updateLocalListingStatus(
  listingId: string,
  patch: Partial<Pick<ShiftMarketListing, 'status' | 'soldToName' | 'soldPrice'>>
): Promise<ShiftMarketListing> {
  const listings = await readAll();
  const index = listings.findIndex((listing) => listing.id === listingId);
  if (index < 0) throw new Error('İlan bulunamadı');

  listings[index] = { ...listings[index]!, ...patch };
  await writeAll(listings);
  return listings[index]!;
}

export async function updateLocalListing(
  listingId: string,
  patch: Partial<
    Pick<
      ShiftMarketListing,
      | 'shiftDate'
      | 'slotLabel'
      | 'startTime'
      | 'endTime'
      | 'durationHours'
      | 'minPrice'
      | 'iban'
      | 'note'
    >
  >
): Promise<ShiftMarketListing> {
  const listings = await readAll();
  const index = listings.findIndex((listing) => listing.id === listingId);
  if (index < 0) throw new Error('İlan bulunamadı');

  listings[index] = { ...listings[index]!, ...patch };
  await writeAll(listings);
  return listings[index]!;
}

export async function resolveLocalExpiredListings(
  resolve: (listing: ShiftMarketListing) => Partial<
    Pick<ShiftMarketListing, 'status' | 'soldToName' | 'soldPrice'>
  > | null
): Promise<ShiftMarketListing[]> {
  const listings = await readAll();
  let changed = false;

  const next = listings.map((listing) => {
    const patch = resolve(listing);
    if (!patch) return listing;
    changed = true;
    return { ...listing, ...patch };
  });

  if (changed) await writeAll(next);
  return next;
}

export async function deleteLocalListing(listingId: string): Promise<void> {
  const listings = await readAll();
  const next = listings.filter((listing) => listing.id !== listingId);
  if (next.length === listings.length) throw new Error('İlan bulunamadı');
  await writeAll(next);
}
