import fs from 'fs';

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync('C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf')),
    useSystemFonts: true,
  }).promise;

  for (let p = 1; p <= 2; p++) {
    const items = (await (await doc.getPage(p)).getTextContent()).items
      .filter((it): it is { str: string; transform: number[] } => 'str' in it)
      .map((it) => ({ str: it.str.trim(), x: Math.round(it.transform[4] ?? 0), y: Math.round(it.transform[5] ?? 0) }));

    const sicils = items.filter((i) => /^57\d{2}$/.test(i.str));
    console.log(`Page ${p} sicils (${sicils.length}):`, sicils.map((s) => `${s.str}@y${s.y}`).join(', '));

    const bad = items.filter((i) => /Vardiyasi|GUNLUK|Toplam/.test(i.str));
    if (bad.length) console.log(`Page ${p} summary items:`, bad.map((b) => `${b.str}@y${b.y}`).join(', '));
  }
}

main();
