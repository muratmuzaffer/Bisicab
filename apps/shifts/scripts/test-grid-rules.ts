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

function extractTokens(body: string, skipNamePadding: boolean) {
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
        if (skipNamePadding) {
          phase = 'shifts'; // padding line after multiline name — skip, don't count as days
        } else {
          phase = 'shifts';
          tokens.push(line);
        }
      } else if (/^\d+s$/.test(line)) {
        continue;
      } else {
        nameParts.push(line.replace(/[-–—]+$/g, '').trim());
      }
    } else if (!/^\d+s$/.test(line)) {
      tokens.push(line);
    }
  }

  return { name: nameParts.join(' ').replace(/\s+/g, ' ').trim(), tokens };
}

function assignDays(
  tokens: string[],
  rule: 'dashLen' | 'dashOne' | 'nameDashes'
): Array<'off' | 'F1' | 'B1' | null> {
  const days: Array<'off' | 'F1' | 'B1' | null> = [];
  let i = 0;
  while (i < tokens.length && days.length < 31) {
    const t = tokens[i]!;
    if (/^[-–—]+$/.test(t)) {
      if (rule === 'dashLen') {
        for (let k = 0; k < t.length && days.length < 31; k++) days.push('off');
      } else {
        days.push('off');
      }
      i++;
      continue;
    }
    if (t === '-') {
      days.push('off');
      i++;
      continue;
    }
    if (/^[FB]\d+$/.test(t)) {
      const slot = t.startsWith('B') ? 'B1' : 'F1';
      if (tokens[i + 1] && /^(4|8)s$/.test(tokens[i + 1]!)) i++;
      days.push(slot);
      i++;
      continue;
    }
    if (/^[-–—]*\d+s$/.test(t)) {
      if (rule === 'dashLen') {
        const dashPart = t.match(/^[-–—]*/)?.[0] ?? '';
        for (let k = 0; k < dashPart.length && days.length < 31; k++) days.push('off');
      }
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
  const expectedDay1 = (summary.b1[0] ?? 0) + (summary.f1[0] ?? 0);
  console.log('Expected day 1 total from PDF summary:', expectedDay1, '(B1=', summary.b1[0], 'F1=', summary.f1[0], ')');

  for (const rule of ['dashLen', 'dashOne'] as const) {
    for (const skipPad of [false, true]) {
      const blocks = getEmployeeBlocks(text);
      const dayCounts = Array(31).fill(0);
      let badLengths = 0;

      for (const { body } of blocks) {
        const { tokens } = extractTokens(body, skipPad);
        const days = assignDays(tokens, rule);
        if (days.filter((d) => d !== null).length !== 31) badLengths++;
        days.forEach((d, idx) => {
          if (d === 'F1' || d === 'B1') dayCounts[idx]++;
        });
      }

      console.log(
        `\nRule=${rule} skipNamePadding=${skipPad}: day1=${dayCounts[0]} badBlocks=${badLengths}`
      );
    }
  }
});
