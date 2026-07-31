import fs from 'fs/promises';
import path from 'path';
import type { ParsedShiftRow, ScheduleData, ShiftScheduleMonth } from './types';
import { dedupeParsedRows } from './dedupe';

const DATA_DIR = path.join(process.cwd(), 'data', 'schedules');
const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');

function schedulePath(year: number, month: number): string {
  return path.join(DATA_DIR, `${year}-${String(month).padStart(2, '0')}.json`);
}

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(PDF_DIR, { recursive: true });
}

export async function saveLocalSchedule(
  year: number,
  month: number,
  title: string,
  entries: ParsedShiftRow[],
  published: boolean,
  pdfBuffer?: Buffer,
  pdfFilename?: string
): Promise<ScheduleData> {
  await ensureDirs();

  let pdfUrl: string | null = null;
  if (pdfBuffer && pdfFilename) {
    const pdfPath = path.join(PDF_DIR, `${year}-${String(month).padStart(2, '0')}-${pdfFilename}`);
    await fs.writeFile(pdfPath, pdfBuffer);
    pdfUrl = `/api/pdf?year=${year}&month=${month}`;
  }

  const monthData: ShiftScheduleMonth = {
    id: `local-${year}-${month}`,
    year,
    month,
    title: title || `${year}-${month} Vardiya`,
    pdfUrl,
    pdfFilename: pdfFilename ?? null,
    published,
  };

  const uniqueEntries = dedupeParsedRows(entries);

  const data: ScheduleData = {
    month: monthData,
    entries: uniqueEntries.map((e, i) => ({
      id: `local-${year}-${month}-${i}`,
      scheduleMonthId: monthData.id,
      driverName: e.driverName,
      shiftDate: e.shiftDate,
      startTime: e.startTime ?? null,
      endTime: e.endTime ?? null,
      durationHours: e.durationHours,
      slotLabel: e.slotLabel ?? (e.durationHours === 4 ? '4s' : '8s'),
      notes: null,
    })),
  };

  await fs.writeFile(schedulePath(year, month), JSON.stringify(data, null, 2), 'utf-8');
  return data;
}

export async function loadLocalSchedule(year: number, month: number): Promise<ScheduleData | null> {
  try {
    const raw = await fs.readFile(schedulePath(year, month), 'utf-8');
    const data = JSON.parse(raw) as ScheduleData;
    if (!data.month.published) return null;
    return data;
  } catch {
    return null;
  }
}

export async function listLocalMonths(): Promise<Array<{ year: number; month: number }>> {
  try {
    await ensureDirs();
    const files = await fs.readdir(DATA_DIR);
    const months: Array<{ year: number; month: number }> = [];

    for (const file of files) {
      const m = file.match(/^(\d{4})-(\d{2})\.json$/);
      if (!m) continue;
      const year = parseInt(m[1]!, 10);
      const month = parseInt(m[2]!, 10);
      const data = await loadLocalSchedule(year, month);
      if (data) months.push({ year, month });
    }

    return months.sort((a, b) => b.year - a.year || b.month - a.month);
  } catch {
    return [];
  }
}

export async function getLocalPdfPath(year: number, month: number): Promise<string | null> {
  try {
    await ensureDirs();
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    const files = await fs.readdir(PDF_DIR);
    const match = files.find((f) => f.startsWith(prefix));
    return match ? path.join(PDF_DIR, match) : null;
  } catch {
    return null;
  }
}

export function hasLocalStorage(): boolean {
  return true;
}
