import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

function getEmployeeBlocks(text: string) {
  const main = text.split(/Vardiya Dagilimi Ozeti/i)[0] ?? text;
  const blocks: Array<{ sicil: string; body: string }> = [];
  const re = /(\d{4})([\s\S]*?)(?=\d{4}(?:[A-Za-zİıĞğÜüŞşÖöÇç]|\s*\n)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(main)) !== null) {
    if (parseInt(m[1]!, 10) >= 5710) blocks.push({ sicil: m[1]!, body: m[2] ?? '' });
  }
  return blocks;
}

function extractTokens(body: string) {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const nameParts: string[] = [];
  const tokens: string[] = [];
  let phase: 'name' | 'shifts' = 'name';
  for (const line of lines) {
    if (phase === 'name') {
      if (/^[FB]\d+$/.test(line)) { phase = 'shifts'; tokens.push(line); }
      else if (/^[-–—]+$/.test(line)) { phase = 'shifts'; }
      else if (!/^\d+s$/.test(line)) nameParts.push(line.replace(/[-–—]+$/g, '').trim());
    } else if (!/^\d+s$/.test(line)) tokens.push(line);
  }
  return { name: nameParts.join(' '), tokens };
}

function day1Slot(tokens: string[]): string {
  let day = 1;
  let i = 0;
  while (i < tokens.length && day <= 1) {
    const t = tokens[i]!;
    if (/^[-–—]+$/.test(t) || t === '-') { day++; i++; continue; }
    if (/^[FB]\d+$/.test(t)) {
      if (day === 1) return t.startsWith('B') ? 'B1' : 'F1';
      day++;
      if (tokens[i + 1] && /^(4|8)s$/.test(tokens[i + 1]!)) i++;
      i++;
      continue;
    }
    if (/^[-–—]*\d+s$/.test(t)) { i++; continue; }
    i++;
  }
  return 'off';
}

pdf(fs.readFileSync(pdfPath)).then(({ text }) => {
  const working: string[] = [];
  const off: string[] = [];
  for (const { sicil, body } of getEmployeeBlocks(text)) {
    const { name, tokens } = extractTokens(body);
    const d1 = day1Slot(tokens);
    (d1 === 'off' ? off : working).push(`${sicil} ${name} -> ${d1}`);
  }
  console.log('WORK day1 (' + working.length + '):');
  working.forEach((x) => console.log(' ', x));
  console.log('OFF day1 (' + off.length + '):');
  off.forEach((x) => console.log(' ', x));
});
