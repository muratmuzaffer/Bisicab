const MONTH_NAMES_ASCII = [
  'ocak',
  'subat',
  'mart',
  'nisan',
  'mayis',
  'haziran',
  'temmuz',
  'agustos',
  'eylul',
  'ekim',
  'kasim',
  'aralik',
];

export function normalizeTrAscii(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/û/g, 'u');
}

/** PDF metni veya dosya adından ay/yıl çıkarır. */
export function detectMonthYear(
  text: string,
  filename?: string | null
): { year: number; month: number; source: 'text' | 'filename' } | null {
  const fromText = detectFromString(text);
  if (fromText) return { ...fromText, source: 'text' };

  if (filename) {
    const fromName = detectFromString(normalizeTrAscii(filename));
    if (fromName) return { ...fromName, source: 'filename' };
  }

  return null;
}

function detectFromString(normalized: string): { year: number; month: number } | null {
  for (let i = 0; i < MONTH_NAMES_ASCII.length; i++) {
    const re = new RegExp(`${MONTH_NAMES_ASCII[i]}[^0-9]*(\\d{4})`, 'i');
    const m = normalized.match(re);
    if (m) return { month: i + 1, year: parseInt(m[1]!, 10) };
  }

  const iso = normalized.match(/(\d{4})[-_/](\d{1,2})/);
  if (iso) {
    const year = parseInt(iso[1]!, 10);
    const month = parseInt(iso[2]!, 10);
    if (month >= 1 && month <= 12) return { year, month };
  }

  return null;
}
