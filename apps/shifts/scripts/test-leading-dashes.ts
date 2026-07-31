import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

function parseSummaryCounts(text: string) {
  const b1Match = text.match(/B1 Vardiyasi \(12:30\)([\d]+)/);
  const f1Match = text.match(/F1 Vardiyasi \(16:30\)([\d]+)/);
  return {
    b1: b1Match?.[1]?.split('').map(Number) ?? [],
    f1: f1Match?.[1]?.split('').map(Number) ?? [],
  };
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
      if (/^[FB]\d+$/.test(line)) {
        phase = 'shifts';
        tokens.push(line);
      } else if (/^[-–—]+$/.test(line)) {
        phase = 'shifts'; // padding after multiline name — ignore
      } else if (/^\d+s$/.test(line)) {
        continue;
      } else {
        const dashMatch = line.match(/[-–—]+$/);
        if (dashMatch) leadingOff = dashMatch[0].length;
        nameParts.push(line.replace(/[-–—]+$/g, '').trim());
      }
    } else if (!/^\d+s$/.test(line)) {
      tokens.push(line);
    }
  }

  return {
    name: nameParts.join(' ').replace(/\s+/g, ' ').trim(),
    leadingOff,
    tokens,
  };
}

function toDays(leadingOff: number, tokens: string[]) {
  const days: Array<'off' | 'F1' | 'B1'> = [];
  for (let i = 0; i < leadingOff && days.length < 31; i++) days.push('off');

  let i = 0;
  while (i < tokens.length && days.length < 31) {
    const t = tokens[i]!;
    if (/^[-–—]+$/.test(t) || t === '-') {
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
      i++;
      continue;
    }
    i++;
  }
  while (days.length < 31) days.push('off');
  return days.slice(0, 31);
}

pdf(fs.readFileSync(pdfPath)).then(({ text }) => {
  const summary = parseSummaryCounts(text);
  const blocks = getEmployeeBlocks(text);
  const dayCounts = Array(31).fill(0);
  const b1Counts = Array(31).fill(0);
  const f1Counts = Array(31).fill(0);

  for (const { body } of blocks) {
    const { name, leadingOff, tokens } = parseBlock(body);
    const days = toDays(leadingOff, tokens);
    days.forEach((d, idx) => {
      if (d === 'B1') {
        dayCounts[idx]++;
        b1Counts[idx]++;
      }
      if (d === 'F1') {
        dayCounts[idx]++;
        f1Counts[idx]++;
      }
    });
    if (name.includes('Alper ARICA')) {
      console.log('Alper leadingOff', leadingOff, 'first 8 days', days.slice(0, 8).join(','));
    }
  }

  console.log('Day1 total', dayCounts[0], 'B1', b1Counts[0], 'F1', f1Counts[0]);
  console.log('Expected', (summary.b1[0] ?? 0) + (summary.f1[0] ?? 0), 'B1', summary.b1[0], 'F1', summary.f1[0]);

  for (let d = 0; d < 5; d++) {
    const ok = b1Counts[d] === summary.b1[d] && f1Counts[d] === summary.f1[d];
    console.log(`Day ${d + 1}: got B1=${b1Counts[d]} F1=${f1Counts[d]} exp B1=${summary.b1[d]} F1=${summary.f1[d]} ${ok ? 'OK' : 'X'}`);
  }
});
