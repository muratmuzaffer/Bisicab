import type { ParsedShiftRow, ScheduleData, ShiftScheduleEntry, ShiftScheduleMonth } from './types';
import {
  buildSlotLabel,
  resolveShiftTimes,
  slotFromToken,
} from './shift-styles';

const DEMO_MONTH: ShiftScheduleMonth = {
  id: 'demo-month',
  year: 2026,
  month: 1,
  title: 'Ocak 2026 Vardiya Çizelgesi',
  pdfUrl: null,
  pdfFilename: null,
  published: true,
};

const DRIVERS = [
  'Ahmet Yılmaz',
  'Ayşe Demir',
  'Mehmet Kaya',
  'Zeynep Öztürk',
  'Can Arslan',
  'Elif Şahin',
  'Burak Çelik',
  'Selin Aydın',
  'Emre Koç',
  'Deniz Yıldız',
];

const MONTH_NAMES_TR = [
  'ocak', 'subat', 'mart', 'nisan', 'mayis', 'haziran',
  'temmuz', 'agustos', 'eylul', 'ekim', 'kasim', 'aralik',
];

const MONTH_NAMES_TR_UNICODE = [
  'ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran',
  'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık',
];

function buildDemoEntries(): ShiftScheduleEntry[] {
  const entries: ShiftScheduleEntry[] = [];
  let id = 1;

  for (let day = 1; day <= 31; day++) {
    const date = `2026-01-${String(day).padStart(2, '0')}`;
    const dow = new Date(date + 'T12:00:00').getDay();

    if (dow === 0) continue;

    const slots: Array<{ start: string; end: string; dur: 4 | 8 }> =
      dow === 6
        ? [
            { start: '09:00', end: '13:00', dur: 4 },
            { start: '13:00', end: '17:00', dur: 4 },
          ]
        : [
            { start: '08:00', end: '16:00', dur: 8 },
            { start: '09:00', end: '13:00', dur: 4 },
            { start: '13:00', end: '17:00', dur: 4 },
            { start: '16:00', end: '20:00', dur: 4 },
          ];

    slots.forEach((slot, slotIdx) => {
      const driverIdx = (day + slotIdx) % DRIVERS.length;
      const driver = DRIVERS[driverIdx]!;
      entries.push({
        id: `demo-${id++}`,
        scheduleMonthId: DEMO_MONTH.id,
        driverName: driver,
        shiftDate: date,
        startTime: slot.start,
        endTime: slot.end,
        durationHours: slot.dur,
        slotLabel: slot.dur === 4 ? '4s' : '8s',
        notes: null,
      });
    });
  }

  return entries;
}

let cachedDemo: ScheduleData | null = null;

export function getDemoSchedule(): ScheduleData {
  if (!cachedDemo) {
    cachedDemo = {
      month: DEMO_MONTH,
      entries: buildDemoEntries(),
    };
  }
  return cachedDemo;
}

export function isDemoMode(): boolean {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function normalizeTr(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

/** PDF metninden ay/yıl çıkarır (ör. "Temmuz 2026"). */
export function detectMonthYearFromText(text: string): { year: number; month: number } | null {
  const normalized = normalizeTr(text);
  for (let i = 0; i < MONTH_NAMES_TR.length; i++) {
    const re = new RegExp(`${MONTH_NAMES_TR[i]}\\s*(\\d{4})`, 'i');
    const m = normalized.match(re);
    if (m) {
      return { month: i + 1, year: parseInt(m[1]!, 10) };
    }
  }
  return null;
}

function isBisiCabVardiyaPdf(text: string): boolean {
  return /BisiCab\s*(Personel\s*)?Vardiya/i.test(text);
}

function cleanName(raw: string): string {
  return raw
    .replace(/[-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEmployeeBlock(
  sicil: string,
  body: string,
  year: number,
  month: number
): ParsedShiftRow[] {
  const rows: ParsedShiftRow[] = [];
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const nameParts: string[] = [];
  const tokens: string[] = [];
  let phase: 'name' | 'shifts' = 'name';

  for (const line of lines) {
    if (phase === 'name') {
      if (/^[FB]\d+$/.test(line)) {
        phase = 'shifts';
        tokens.push(line);
      } else if (/^[-–—]+$/.test(line)) {
        phase = 'shifts';
        tokens.push(line);
      } else if (/^\d+s$/.test(line)) {
        continue;
      } else {
        nameParts.push(line.replace(/[-–—]+$/g, '').trim());
      }
    } else {
      if (/^\d+s$/.test(line)) continue;
      tokens.push(line);
    }
  }

  const driverName = cleanName(nameParts.join(' '));
  if (!driverName || driverName.length < 2) return rows;

  let day = 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let i = 0; i < tokens.length && day <= daysInMonth; i++) {
    const token = tokens[i]!;

    if (/^[-–—]+$/.test(token)) {
      day += token.length;
      continue;
    }

    if (token === '-') {
      day += 1;
      continue;
    }

    if (/^[FBSDO]\*?\d?$/.test(token) || /^S1$/.test(token)) {
      const slotInfo = slotFromToken(token);
      if (!slotInfo) {
        day += 1;
        continue;
      }

      const next = tokens[i + 1];
      let durationHours = slotInfo.hours;

      if (next && /^(4|8)s$/.test(next)) {
        durationHours = next.startsWith('8') ? 8 : 4;
        i += 1;
      }

      const times = resolveShiftTimes(slotInfo.slot, durationHours);
      const shiftDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      rows.push({
        driverName,
        shiftDate,
        startTime: times.start,
        endTime: times.end,
        durationHours,
        slotLabel: buildSlotLabel(slotInfo.slot, durationHours),
      });

      day += 1;
      continue;
    }

    if (/^[-–—]*\d+s$/.test(token)) {
      const dashPart = token.match(/^[-–—]*/)?.[0] ?? '';
      day += dashPart.length;
      continue;
    }
  }

  return rows;
}

/** BisiCab Personel Vardiya Sistemi PDF formatı. */
export function parseBisiCabVardiyaPdf(
  text: string,
  year: number,
  month: number
): ParsedShiftRow[] {
  const detected = detectMonthYearFromText(text);
  const y = detected?.year ?? year;
  const m = detected?.month ?? month;

  const rows: ParsedShiftRow[] = [];

  const mainSection = text.split(/Vardiya Dagilimi Ozeti/i)[0] ?? text;

  const blockPattern = /(\d{4})([\s\S]*?)(?=\d{4}(?:[A-Za-zİıĞğÜüŞşÖöÇç]|\s*\n)|$)/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(mainSection)) !== null) {
    const sicil = match[1]!;
    const body = match[2] ?? '';
    if (sicil.startsWith('000') || parseInt(sicil, 10) < 1000) continue;
    rows.push(...parseEmployeeBlock(sicil, body, y, m));
  }

  return rows;
}

/** PDF metninden vardiya satırlarını çıkarmaya çalışır. */
export function parseShiftText(text: string, year: number, month: number): ParsedShiftRow[] {
  if (isBisiCabVardiyaPdf(text)) {
    return parseBisiCabVardiyaPdf(text, year, month);
  }

  const rows: ParsedShiftRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const datePatterns = [
    /(\d{1,2})[\.\/\-](\d{1,2})(?:[\.\/\-]\d{2,4})?/,
    /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/i,
  ];

  for (const line of lines) {
    const durMatch = line.match(/\b(4|8)\s*s\b/i);
    if (!durMatch) continue;

    const durationHours = (parseInt(durMatch[1]!, 10) === 8 ? 8 : 4) as 4 | 8;

    const timeMatch = line.match(/(\d{1,2}[:\.]\d{2})\s*[-–]\s*(\d{1,2}[:\.]\d{2})/);
    let startTime: string | undefined;
    let endTime: string | undefined;
    if (timeMatch) {
      startTime = timeMatch[1]!.replace('.', ':');
      endTime = timeMatch[2]!.replace('.', ':');
      if (startTime.length === 4) startTime = '0' + startTime;
      if (endTime.length === 4) endTime = '0' + endTime;
    }

    let day: number | null = null;
    for (const pat of datePatterns) {
      const m = line.match(pat);
      if (m) {
        if (m[2] && isNaN(Number(m[2]))) {
          day = parseInt(m[1]!, 10);
        } else {
          day = parseInt(m[1]!, 10);
        }
        break;
      }
    }

    if (!day || day < 1 || day > 31) continue;

    const namePart = line
      .replace(/\b(4|8)\s*s\b/gi, '')
      .replace(/\d{1,2}[:\.]\d{2}\s*[-–]\s*\d{1,2}[:\.]\d{2}/g, '')
      .replace(/\d{1,2}[\.\/\-]\d{1,2}(?:[\.\/\-]\d{2,4})?/g, '')
      .replace(/[^\p{L}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (namePart.length < 3) continue;

    const shiftDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    rows.push({
      driverName: namePart,
      shiftDate,
      startTime,
      endTime,
      durationHours,
      slotLabel: durationHours === 4 ? '4s' : '8s',
    });
  }

  return rows;
}

/** CSV: driver_name,date,start_time,end_time,duration */
export function parseCsv(text: string): ParsedShiftRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0]!.toLowerCase();
  const hasHeader =
    header.includes('driver') || header.includes('sürücü') || header.includes('isim');

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: ParsedShiftRow[] = [];

  for (const line of dataLines) {
    const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''));
    if (parts.length < 2) continue;

    const [name, date, start, end, dur] = parts;
    if (!name || !date) continue;

    let durationHours: 4 | 8 = 4;
    if (dur) {
      const d = dur.toLowerCase().replace(/\s/g, '');
      durationHours = d.includes('8') ? 8 : 4;
    } else if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      if (!isNaN(sh!) && !isNaN(eh!)) {
        const hours = (eh! + (em ?? 0) / 60) - (sh! + (sm ?? 0) / 60);
        durationHours = hours >= 6 ? 8 : 4;
      }
    }

    let isoDate = date;
    if (date.includes('.')) {
      const [d, m, y] = date.split('.');
      isoDate = `${y ?? new Date().getFullYear()}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
    }

    rows.push({
      driverName: name,
      shiftDate: isoDate,
      startTime: start || undefined,
      endTime: end || undefined,
      durationHours,
      slotLabel: durationHours === 4 ? '4s' : '8s',
    });
  }

  return rows;
}

export { MONTH_NAMES_TR_UNICODE as MONTH_NAMES_TR };
