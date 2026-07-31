import fs from 'fs';

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

  // Find "Car" weekday headers and day numbers
  const dayNums = items.filter((i) => /^([1-9]|1[0-9]|2[0-9]|30|31)$/.test(i.str));
  console.log('Day number items sample:', dayNums.slice(0, 15).map((i) => `y${i.y} x${i.x}:${i.str}`));

  // Group by y for rows containing "1" and "Car"
  const yGroups = new Map<number, typeof items>();
  for (const it of items) {
    if (it.y < 540 && it.y > 520) {
      const arr = yGroups.get(it.y) ?? [];
      arr.push(it);
      yGroups.set(it.y, arr);
    }
  }
  for (const [y, row] of [...yGroups.entries()].sort((a, b) => b[0] - a[0])) {
    const sorted = row.sort((a, b) => a.x - b.x);
    if (sorted.some((s) => s.str === '1' || s.str === 'Car')) {
      console.log(`\nRow y=${y}:`, sorted.map((s) => `${s.x}:${s.str}`).join(' | '));
    }
  }
}

main().catch(console.error);
