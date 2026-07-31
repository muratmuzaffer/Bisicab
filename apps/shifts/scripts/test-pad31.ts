import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

function parseSummary(text: string) {
  const b1 = text.match(/B1 Vardiyasi \(12:30\)([\d]+)/)?.[1]?.slice(0, 31).split('').map(Number) ?? [];
  const f1 = text.match(/F1 Vardiyasi \(16:30\)([\d]+)/)?.[1]?.slice(0, 31).split('').map(Number) ?? [];
  return { b1, f1 };
}

function getEmployeeBlocks(text: string) {
  const main = text.split(/Vardiya Dagilimi Ozeti/i)[0] ?? text;
  const blocks: Array<{ body: string }> = [];
  const re = /(\d{4})([\s\S]*?)(?=\d{4}(?:[A-Za-zİıĞğÜüŞşÖöÇç]|\s*\n)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(main)) !== null) {
    if (parseInt(m[1]!, 10) >= 5710) blocks.push({ body: m[2] ?? '' });
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
      if (/^[FB]\d+$/.test(line)) {
        phase = 'shifts';
        tokens.push(line);
      } else if (/^[-–—]+$/.test(line)) {
        phase = 'shifts';
      } else if (/^\d+s$/.test(line)) {
        continue;
      } else {
        nameParts.push(line.replace(/[-–—]+$/g, '').trim());
      }
    } else if (!/^\d+s$/.test(line)) {
      tokens.push(line);
    }
  }
  return { name: nameParts.join(' '), tokens };
}

function tokensToDays(tokens: string[]): Array<'off' | 'F1' | 'B1'> {
  const days: Array<'off' | 'F1' | 'B1'> = [];
  let i = 0;

  while (i < tokens.length && days.length < 31) {
    const t = tokens[i]!;

    if (/^[-–—]+$/.test(t)) {
      for (let k = 0; k < t.length && days.length < 31; k++) days.push('off');
      i++;
      continue;
    }

    if (t === '-') {
      days.push('off');
      i++;
      continue;
    }

    if (/^[FB]\d+$/.test(t)) {
      days.push(t.startsWith('B') ? 'B1' : 'F1');
      if (tokens[i + 1] && /^(4|8)s$/.test(tokens[i + 1]!)) i++;
      i++;
      continue;
    }

    if (/^[-–—]*\d+s$/.test(t)) {
      const dashPart = t.match(/^[-–—]*/)?.[0] ?? '';
      for (let k = 0; k < dashPart.length && days.length < 31; k++) days.push('off');
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
  const blocks = getEmployeeBlocks(text);
  const b1 = Array(31).fill(0);
  const f1 = Array(31).fill(0);
  let lengthErrors = 0;

  for (const { body } of blocks) {
    const { tokens } = extractTokens(body);
    const days = tokensToDays(tokens);
    if (days.length !== 31) lengthErrors++;
    days.forEach((d, idx) => {
      if (d === 'B1') b1[idx]++;
      if (d === 'F1') f1[idx]++;
    });
  }

  let allOk = true;
  for (let d = 0; d < 31; d++) {
    const ok = b1[d] === summary.b1[d] && f1[d] === summary.f1[d];
    if (!ok) {
      allOk = false;
      console.log(`Day ${d + 1}: got B1=${b1[d]} F1=${f1[d]} exp B1=${summary.b1[d]} F1=${summary.f1[d]}`);
    }
  }
  console.log('Day1 total', b1[0] + f1[0], 'expected', summary.b1[0] + summary.f1[0]);
  console.log('All match:', allOk, 'lengthErrors', lengthErrors);
});
