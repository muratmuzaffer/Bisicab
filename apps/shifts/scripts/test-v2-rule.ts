import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';
const PADDING_DASH_LEN = 6;

function parseSummary(text: string) {
  const b1 = text.match(/B1 Vardiyasi \(12:30\)([\d]+)/)?.[1]?.slice(0, 31).split('').map(Number) ?? [];
  const f1 = text.match(/F1 Vardiyasi \(16:30\)([\d]+)/)?.[1]?.slice(0, 31).split('').map(Number) ?? [];
  return { b1, f1 };
}

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

function parseBlock(body: string) {
  const lines = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let leadingOff = 0;
  const nameParts: string[] = [];
  const tokens: string[] = [];
  let phase: 'name' | 'shifts' = 'name';

  for (const line of lines) {
    if (phase === 'name') {
      if (/^[FB]\d+$/.test(line)) { phase = 'shifts'; tokens.push(line); }
      else if (/^[-–—]+$/.test(line)) {
        phase = 'shifts';
        if (line.length < PADDING_DASH_LEN) tokens.push(line);
      } else if (/^\d{2,}s$/.test(line)) continue;
      else {
        const dm = line.match(/([-–—]+)$/);
        const dlen = dm?.[1]?.length ?? 0;
        if (dlen > 0 && dlen < PADDING_DASH_LEN) leadingOff += dlen;
        nameParts.push(line.replace(/[-–—]+$/g, '').trim());
      }
    } else if (!/^\d{2,}s$/.test(line)) {
      if (/^[-–—]+$/.test(line) && line.length >= PADDING_DASH_LEN) continue;
      if (/^[-–—]*\d{2,}s$/.test(line)) continue;
      tokens.push(line);
    }
  }
  return { name: nameParts.join(' '), leadingOff, tokens };
}

function toDays(leadingOff: number, tokens: string[]) {
  const days: Array<'off' | 'F1' | 'B1'> = [];
  for (let i = 0; i < leadingOff && days.length < 31; i++) days.push('off');
  let i = 0;
  while (i < tokens.length && days.length < 31) {
    const t = tokens[i]!;
    if (/^[-–—]+$/.test(t) || t === '-') { days.push('off'); i++; continue; }
    if (/^[FB]\d+$/.test(t)) {
      days.push(t.startsWith('B') ? 'B1' : 'F1');
      if (tokens[i + 1] && /^(4|8)s$/.test(tokens[i + 1]!)) i++;
      i++;
      continue;
    }
    i++;
  }
  while (days.length < 31) days.push('off');
  return days;
}

pdf(fs.readFileSync(pdfPath)).then(({ text }) => {
  const summary = parseSummary(text);
  const b1 = Array(31).fill(0);
  const f1 = Array(31).fill(0);
  const day1Workers: string[] = [];

  for (const { sicil, body } of getEmployeeBlocks(text)) {
    const { name, leadingOff, tokens } = parseBlock(body);
    const days = toDays(leadingOff, tokens);
    if (days[0] !== 'off') day1Workers.push(`${name} ${days[0]}`);
    days.forEach((d, idx) => {
      if (d === 'B1') b1[idx]++;
      if (d === 'F1') f1[idx]++;
    });
  }

  console.log('Day1 workers (' + day1Workers.length + '):', day1Workers.join(', '));
  console.log('Day1 B1', b1[0], 'F1', f1[0], 'total', b1[0]+f1[0], 'exp', summary.b1[0]+summary.f1[0]);

  let ok = 0;
  for (let d = 0; d < 31; d++) {
    if (b1[d] === summary.b1[d] && f1[d] === summary.f1[d]) ok++;
    else console.log(`Day ${d+1}: B1 ${b1[d]}/${summary.b1[d]} F1 ${f1[d]}/${summary.f1[d]}`);
  }
  console.log('Matching days:', ok, '/ 31');
});
