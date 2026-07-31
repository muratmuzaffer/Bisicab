import fs from 'fs';
import { parseBisiCabPdfWithPositions } from '../src/lib/pdf-grid-parser';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

parseBisiCabPdfWithPositions(fs.readFileSync(pdfPath), 2026, 7).then((rows) => {
  const july1 = rows.filter((r) => r.shiftDate === '2026-07-01');
  console.log('July 1 count:', july1.length);
  july1.forEach((r) => console.log(' ', r.driverName, r.slotLabel));

  console.log('\nPer day (1-5):');
  for (let d = 1; d <= 5; d++) {
    const date = `2026-07-${String(d).padStart(2, '0')}`;
    console.log(`  Day ${d}:`, rows.filter((r) => r.shiftDate === date).length);
  }

  const alper = rows.filter((r) => r.driverName.includes('Alper ARICA'));
  console.log('\nAlper shifts:', alper.map((r) => r.shiftDate).join(', '));
});
