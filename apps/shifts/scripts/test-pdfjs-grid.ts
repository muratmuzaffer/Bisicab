import fs from 'fs';
import { pathToFileURL } from 'url';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();

  const items = content.items
    .filter((it): it is { str: string; transform: number[] } => 'str' in it && !!it.str.trim())
    .map((it) => ({
      str: it.str.trim(),
      x: Math.round(it.transform[4] ?? 0),
      y: Math.round(it.transform[5] ?? 0),
    }));

  // Header row - highest y values
  const maxY = Math.max(...items.map((i) => i.y));
  const headerRow = items.filter((i) => i.y >= maxY - 5).sort((a, b) => a.x - b.x);
  console.log('Header row y=', maxY);
  console.log(headerRow.map((i) => `${i.x}:${i.str}`).join(' | '));

  // Build x -> day map from header numbers 1-31
  const dayCols = headerRow.filter((i) => /^\d{1,2}$/.test(i.str)).map((i) => ({ day: +i.str, x: i.x }));
  console.log('Day columns:', dayCols.length, dayCols.slice(0, 5), '...', dayCols.slice(-3));

  function xToDay(x: number): number {
    let best = 1;
    let bestDist = Infinity;
    for (const col of dayCols) {
      const dist = Math.abs(col.x - x);
      if (dist < bestDist) { bestDist = dist; best = col.day; }
    }
    return bestDist <= 15 ? best : -1;
  }

  // Parse first employee row
  const sicils = items.filter((i) => /^57\d{2}$/.test(i.str));
  const y0 = sicils[0]!.y;
  const row = items.filter((i) => Math.abs(i.y - y0) <= 4 && i.x > 140).sort((a, b) => a.x - b.x);

  console.log('\nAlper mapped days:');
  for (const it of row) {
    const day = xToDay(it.x);
    if (day > 0 && it.str !== '-') console.log(`  day ${day}: ${it.str} (x=${it.x})`);
  }
}

main().catch(console.error);
