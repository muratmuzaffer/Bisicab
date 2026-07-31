import fs from 'fs';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), useSystemFonts: true }).promise;

  const allItems = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    for (const it of content.items) {
      if ('str' in it && it.str.trim()) {
        allItems.push({ str: it.str.trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]), page: p });
      }
    }
  }

  const dayCols = allItems.filter((i) => i.y >= 540 && i.y <= 550 && /^\d{1,2}$/.test(i.str));
  console.log('dayCols', dayCols.length);

  const sicils = allItems.filter((i) => /^57\d{2}$/.test(i.str));
  console.log('sicils', sicils.length);

  const sicil = sicils[0];
  const rowItems = allItems.filter((i) => Math.abs(i.y - sicil.y) <= 4 && i.x > 100).sort((a, b) => a.x - b.x);
  console.log('row', rowItems.map((i) => `${i.x}:${i.str}`).join(' | '));

  function xToDay(x: number) {
    let best = null, bestDist = Infinity;
    for (const col of dayCols) {
      const d = Math.abs(col.x - x);
      if (d < bestDist) { bestDist = d; best = +col.str; }
    }
    return bestDist <= 14 ? best : null;
  }

  for (const item of rowItems) {
    if (item.x < 145) continue;
    const day = xToDay(item.x);
    console.log(`x${item.x} "${item.str}" -> day ${day}`);
  }
}

main();
