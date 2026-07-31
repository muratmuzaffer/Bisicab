import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { CreateShiftSwapInput, ShiftSwap } from './types';

const SWAPS_FILE = path.join(process.cwd(), 'data', 'swaps.json');

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
  return JSON.parse(raw) as ShiftSwap[];
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

export async function createLocalSwap(input: CreateShiftSwapInput): Promise<ShiftSwap> {
  const swaps = await readAll();
  const swap: ShiftSwap = {
    id: randomUUID(),
    requesterName: input.requesterName.trim(),
    partnerName: input.partnerName.trim(),
    requesterDate: input.requesterDate,
    partnerDate: input.partnerDate,
    requesterSlot: input.requesterSlot ?? null,
    partnerSlot: input.partnerSlot ?? null,
    note: input.note?.trim() ?? null,
    createdAt: new Date().toISOString(),
  };
  swaps.unshift(swap);
  await writeAll(swaps);
  return swap;
}
