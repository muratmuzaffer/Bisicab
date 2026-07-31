import fs from 'fs';
import pdf from 'pdf-parse';
import { parseShiftText } from '../src/lib/schedule-data';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

pdf(fs.readFileSync(pdfPath)).then(({ text }) => {
  const rows = parseShiftText(text, 2026, 7);
  const july1 = rows.filter((r) => r.shiftDate === '2026-07-01');
  console.log('July 1 count:', july1.length);
  july1.forEach((r) => console.log(`  ${r.driverName} ${r.slotLabel}`));

  // Expected from PDF summary page: day 1 has B1=5, F1=3 => 8 total
  console.log('\nPer day counts (first 5 days):');
  for (let d = 1; d <= 5; d++) {
    const date = `2026-07-${String(d).padStart(2, '0')}`;
    const dayRows = rows.filter((r) => r.shiftDate === date);
    console.log(`  Day ${d}: ${dayRows.length}`);
  }

  // Check a specific employee - Arda Cem HANOGLU first shift day
  const arda = rows.filter((r) => r.driverName.includes('HANOGLU'));
  console.log('\nArda Cem HANOGLU first 3 shifts:', arda.slice(0, 3).map((r) => r.shiftDate));
});
