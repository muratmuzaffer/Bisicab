import fs from 'fs';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

async function main() {
  const { parseBisiCabPdfWithPositions } = await import('../src/lib/pdf-grid-parser');
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const text = (await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), useSystemFonts: true }).promise)
    .getPage(1)
    .then((p) => p.getTextContent())
    .then((c) => c.items.map((i) => ('str' in i ? i.str : '')).join('\n'));

  const rows = await parseBisiCabPdfWithPositions(fs.readFileSync(pdfPath), 2026, 7);

  const summary = {
    b1: '5555555555555555555555555555555155'.split('').map(Number),
    f1: '3555555555555555555555555555555153'.split('').map(Number),
  };

  const b1 = Array(31).fill(0);
  const f1 = Array(31).fill(0);
  for (const r of rows) {
    const day = parseInt(r.shiftDate.split('-')[2]!, 10) - 1;
    if (r.durationHours === 8) b1[day]++;
    else f1[day]++;
  }

  let ok = 0;
  for (let d = 0; d < 31; d++) {
    const match = b1[d] === summary.b1[d] && f1[d] === summary.f1[d];
    if (match) ok++;
    else console.log(`Day ${d + 1}: B1 ${b1[d]}/${summary.b1[d]} F1 ${f1[d]}/${summary.f1[d]}`);
  }
  console.log('Total rows', rows.length, 'drivers', new Set(rows.map((r) => r.driverName)).size);
  console.log('Matching days', ok, '/ 31');
  console.log('Bad names:', [...new Set(rows.map((r) => r.driverName))].filter((n) => /Vardiya|Toplam/i.test(n)));
}

main();
