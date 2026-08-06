import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { parseMarketListingIdFromNote } from './swap-utils';
import type { ShiftSwap, ShiftSwapSource, SwapShiftItem } from './types';

const SWAPS_FILE = path.join(process.cwd(), 'data', 'swaps.json');

type StoredSwapInput = {
  requesterName: string;
  partnerName: string;
  requesterDate: string | null;
  partnerDate: string;
  requesterSlot: string | null;
  partnerSlot: string | null;
  requesterShifts: SwapShiftItem[];
  partnerShifts: SwapShiftItem[];
  note: string | null;
  oneWay?: boolean;
  source?: ShiftSwapSource;
  marketListingId?: string | null;
  soldPrice?: number | null;
};

function normalizeStoredSwap(swap: ShiftSwap): ShiftSwap {
  const marketListingId =
    swap.marketListingId ?? parseMarketListingIdFromNote(swap.note) ?? null;
  const source: ShiftSwapSource =
    swap.source === 'market' ||
    Boolean(marketListingId) ||
    Boolean(swap.note?.startsWith('Pazar ·'))
      ? 'market'
      : 'swap';
  return {
    ...swap,
    cancelRequestedAt: swap.cancelRequestedAt ?? null,
    cancelRequestedBy: swap.cancelRequestedBy ?? null,
    source,
    marketListingId,
    soldPrice: swap.soldPrice ?? null,
  };
}

async function ensureFile() {
  await fs.mkdir(path.dirname(SWAPS_FILE), { recursive: true });
  try {
    await fs.access(SWAPS_FILE);
  } catch {
    await fs.writeFile(SWAPS_FILE, '[]', 'utf-8');
  }
}

async function readAll(): Promise<ShiftSwap[]> {
  await ensureFile();
  const raw = await fs.readFile(SWAPS_FILE, 'utf-8');
  const swaps = JSON.parse(raw) as ShiftSwap[];
  return swaps.map(normalizeStoredSwap);
}

async function writeAll(swaps: ShiftSwap[]) {
  await ensureFile();
  await fs.writeFile(SWAPS_FILE, JSON.stringify(swaps, null, 2), 'utf-8');
}

export async function listLocalSwaps(limit = 100): Promise<ShiftSwap[]> {
  const swaps = await readAll();
  return swaps
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function createLocalSwap(input: StoredSwapInput): Promise<ShiftSwap> {
  const swaps = await readAll();
  const requesterShifts = input.requesterShifts ?? [];
  const partnerShifts = input.partnerShifts ?? [];
  const legacyGive = requesterShifts[0];
  const legacyTake = partnerShifts[0];
  const marketListingId = input.marketListingId?.trim() || null;

  if (marketListingId && swaps.some((s) => s.marketListingId === marketListingId)) {
    return swaps.find((s) => s.marketListingId === marketListingId)!;
  }

  const swap: ShiftSwap = {
    id: randomUUID(),
    requesterName: input.requesterName.trim(),
    partnerName: input.partnerName.trim(),
    requesterDate: input.requesterDate ?? legacyGive?.date ?? null,
    partnerDate: input.partnerDate ?? legacyTake?.date ?? '',
    requesterSlot: input.requesterSlot ?? legacyGive?.slot ?? null,
    partnerSlot: input.partnerSlot ?? legacyTake?.slot ?? null,
    requesterShifts,
    partnerShifts,
    note: input.note?.trim() ?? null,
    createdAt: new Date().toISOString(),
    cancelRequestedAt: null,
    cancelRequestedBy: null,
    source: input.source === 'market' || Boolean(marketListingId) ? 'market' : 'swap',
    marketListingId,
    soldPrice: input.soldPrice ?? null,
  };

  swaps.unshift(swap);
  await writeAll(swaps);
  return swap;
}

export async function findLocalSwapById(id: string): Promise<ShiftSwap | null> {
  const swaps = await readAll();
  return swaps.find((swap) => swap.id === id) ?? null;
}

export async function findLocalSwapByMarketListingId(
  listingId: string
): Promise<ShiftSwap | null> {
  const swaps = await readAll();
  return swaps.find((swap) => swap.marketListingId === listingId) ?? null;
}

export async function deleteLocalSwap(id: string): Promise<void> {
  const swaps = await readAll();
  const next = swaps.filter((swap) => swap.id !== id);
  if (next.length === swaps.length) {
    throw new Error('Değişim kaydı bulunamadı');
  }
  await writeAll(next);
}

export async function requestLocalSwapCancel(id: string, requestedBy: string): Promise<ShiftSwap> {
  const swaps = await readAll();
  const index = swaps.findIndex((swap) => swap.id === id);
  if (index < 0) throw new Error('Değişim kaydı bulunamadı');

  const swap = swaps[index]!;
  if (swap.cancelRequestedAt) {
    throw new Error('Bu değişim için zaten iptal talebi var');
  }

  const updated: ShiftSwap = {
    ...swap,
    cancelRequestedAt: new Date().toISOString(),
    cancelRequestedBy: requestedBy.trim(),
  };
  swaps[index] = updated;
  await writeAll(swaps);
  return updated;
}

export async function rejectLocalSwapCancel(id: string): Promise<ShiftSwap> {
  const swaps = await readAll();
  const index = swaps.findIndex((swap) => swap.id === id);
  if (index < 0) throw new Error('Değişim kaydı bulunamadı');

  const updated: ShiftSwap = {
    ...swaps[index]!,
    cancelRequestedAt: null,
    cancelRequestedBy: null,
  };
  swaps[index] = updated;
  await writeAll(swaps);
  return updated;
}

export async function listLocalPendingCancelRequests(limit = 50): Promise<ShiftSwap[]> {
  const swaps = await readAll();
  return swaps
    .filter((swap) => Boolean(swap.cancelRequestedAt))
    .sort((a, b) => (b.cancelRequestedAt ?? '').localeCompare(a.cancelRequestedAt ?? ''))
    .slice(0, limit);
}
