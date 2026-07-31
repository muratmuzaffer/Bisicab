import fs from 'fs';
import path from 'path';
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

  // Find day header "1" near top
  const dayHeaders = items.filter((it) => /^(\d{1,2})$/.test(it.str) && it.y > 700);
  console.log('Sample day headers:', dayHeaders.slice(0, 8));

  // Employee rows around y=650..400
  const sicilItems = items.filter((it) => /^57\d{2}$/.test(it.str));
  console.log('Sicils found:', sicilItems.length, sicilItems.slice(0, 3));

  // Items near first sicil row
  const y0 = sicilItems[0]?.y ?? 0;
  const rowItems = items.filter((it) => Math.abs(it.y - y0) <= 3).sort((a, b) => a.x - b.x);
  console.log('First row items:', rowItems.map((i) => `${i.x}:${i.str}`).join(' | '));
}

main().catch(console.error);
