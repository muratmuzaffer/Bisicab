import type { ParsedShiftRow } from './types';

const SLOT_TIMES: Record<string, { start: string; end: string; hours: 4 | 8 }> = {
  F1: { start: '16:30', end: '20:30', hours: 4 },
  B1: { start: '12:30', end: '20:30', hours: 8 },
};

interface TextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

export async function parseBisiCabPdfWithPositions(
  buffer: Buffer,
  year: number,
  month: number
): Promise<ParsedShiftRow[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  const allItems: TextItem[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      allItems.push({
        str: it.str.trim(),
        x: Math.round((it as { transform: number[] }).transform[4] ?? 0),
        y: Math.round((it as { transform: number[] }).transform[5] ?? 0),
        page: p,
      });
    }
  }

  const dayCols = allItems
    .filter((i) => i.page === 1 && i.y >= 540 && i.y <= 550 && /^\d{1,2}$/.test(i.str))
    .map((i) => ({ day: parseInt(i.str, 10), x: i.x }))
    .sort((a, b) => a.day - b.day);

  if (dayCols.length < 28) {
    throw new Error('PDF tablo başlığı okunamadı');
  }

  function xToDay(x: number): number | null {
    let best: number | null = null;
    let bestDist = Infinity;
    for (const col of dayCols) {
      const dist = Math.abs(col.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = col.day;
      }
    }
    return bestDist <= 14 ? best : null;
  }

  const sicilRows = allItems.filter((i) => i.page === 1 && /^57\d{2}$/.test(i.str));
  const rows: ParsedShiftRow[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  for (const sicil of sicilRows) {
    const rowItems = allItems
      .filter((i) => i.page === sicil.page && Math.abs(i.y - sicil.y) <= 4 && i.x >= 50 && i.str !== sicil.str)
      .sort((a, b) => a.x - b.x);

    const nameParts = rowItems.filter(
      (i) =>
        i.x < 145 &&
        !/^[-–—]+$/.test(i.str) &&
        !/^\d{2,}s$/.test(i.str) &&
        !/^[FB]\d+$/.test(i.str) &&
        !/^(4|8)s$/.test(i.str) &&
        !/Vardiyasi|Toplam|GUNLUK/i.test(i.str)
    );
    const driverName = nameParts
      .map((i) => i.str.replace(/[-–—]+$/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!driverName || driverName.length < 2 || /Vardiyasi|Toplam|GUNLUK/i.test(driverName)) continue;

    const dayCells = new Map<number, { slot?: string; hours?: 4 | 8 }>();

    for (const item of rowItems) {
      if (item.x < 145) continue;
      const day = xToDay(item.x);
      if (!day || day > daysInMonth) continue;

      if (/^[-–—]+$/.test(item.str) || item.str === '-') {
        dayCells.set(day, {});
        continue;
      }

      if (/^[FB]\d+$/.test(item.str)) {
        const cell = dayCells.get(day) ?? {};
        cell.slot = item.str;
        cell.hours = SLOT_TIMES[item.str]?.hours ?? (item.str.startsWith('B') ? 8 : 4);
        dayCells.set(day, cell);
        continue;
      }

      if (/^(4|8)s$/.test(item.str)) {
        const cell = dayCells.get(day) ?? {};
        cell.hours = item.str.startsWith('8') ? 8 : 4;
        dayCells.set(day, cell);
      }
    }

    for (const [day, cell] of dayCells.entries()) {
      if (!cell.slot) continue;
      const times = SLOT_TIMES[cell.slot];
      const durationHours = cell.hours ?? times?.hours ?? 4;
      const shiftDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      rows.push({
        driverName,
        shiftDate,
        startTime: times?.start,
        endTime: times?.end,
        durationHours,
        slotLabel: `${cell.slot} ${durationHours}s`,
      });
    }
  }

  return rows;
}

export function detectMonthYearFromPdfText(text: string): { year: number; month: number } | null {
  const normalized = text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

  const months = [
    'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran',
    'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik',
  ];

  for (let i = 0; i < months.length; i++) {
    const re = new RegExp(`${months[i]}\\s*(\\d{4})`, 'i');
    const m = normalized.match(re);
    if (m) return { month: i + 1, year: parseInt(m[1]!, 10) };
  }
  return null;
}
