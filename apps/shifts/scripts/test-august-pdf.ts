import fs from 'node:fs';
import pdf from 'pdf-parse';
import { detectMonthYearFromText } from '../src/lib/schedule-data';
import {
  detectMonthYearFromPdfText,
  parseBisiCabPdfWithPositions,
} from '../src/lib/pdf-grid-parser';

const path =
  process.argv[2] ??
  'C:/Users/ma727/OneDrive/Masaüstü/BisiCab Agustos 2026 Vardiya Listesi.pdf';

async function main() {
  const buffer = fs.readFileSync(path);
  const parsed = await pdf(buffer);
  console.log('FULL TEXT TAIL (last 500):');
  console.log(parsed.text.slice(-500));
  console.log('---');
  console.log('detectMonthYearFromText:', detectMonthYearFromText(parsed.text));
  console.log('detectMonthYearFromPdfText:', detectMonthYearFromPdfText(parsed.text));
  console.log('BisiCab match:', /BisiCab\s*(Personel\s*)?Vardiya/i.test(parsed.text));

  for (const month of [7, 8]) {
    try {
      const rows = await parseBisiCabPdfWithPositions(buffer, 2026, month);
      const prefix = month === 8 ? '2026-08' : '2026-07';
      const day1 = rows.filter((r) => r.shiftDate === `${prefix}-01`);
      console.log(`month=${month} rows=${rows.length} drivers=${new Set(rows.map((r) => r.driverName)).size}`);
      console.log(`month=${month} day1=${day1.length}`, day1.map((r) => `${r.driverName} ${r.slotLabel}`).join(' | '));
      const wrong = rows.filter((r) => !r.shiftDate.startsWith(prefix));
      console.log(`month=${month} wrong-date rows=${wrong.length}`);
    } catch (e) {
      console.error(`month=${month} parse error:`, e);
    }
  }
}

main();
