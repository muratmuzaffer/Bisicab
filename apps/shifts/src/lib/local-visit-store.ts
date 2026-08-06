import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DriverVisit } from './visit-types';

const VISITS_FILE = path.join(process.cwd(), 'data', 'visits.json');

async function ensureFile() {
  await fs.mkdir(path.dirname(VISITS_FILE), { recursive: true });
  try {
    await fs.access(VISITS_FILE);
  } catch {
    await fs.writeFile(VISITS_FILE, '[]', 'utf-8');
  }
}

async function readAll(): Promise<DriverVisit[]> {
  await ensureFile();
  const raw = await fs.readFile(VISITS_FILE, 'utf-8');
  return JSON.parse(raw) as DriverVisit[];
}

async function writeAll(visits: DriverVisit[]) {
  await ensureFile();
  await fs.writeFile(VISITS_FILE, JSON.stringify(visits, null, 2), 'utf-8');
}

export async function createLocalVisit(
  driverName: string,
  userAgent: string | null
): Promise<DriverVisit> {
  const visits = await readAll();
  const visit: DriverVisit = {
    id: randomUUID(),
    driverName: driverName.trim(),
    userAgent,
    createdAt: new Date().toISOString(),
  };
  visits.unshift(visit);
  await writeAll(visits.slice(0, 500));
  return visit;
}

export async function listLocalVisits(limit = 100): Promise<DriverVisit[]> {
  const visits = await readAll();
  return visits
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
