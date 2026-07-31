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

function countDaySlots(tokens: string[], dashMode: 'len' | 'one') {
  let days = 0;
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/^[-–—]+$/.test(t) || t === '-') {
      days += dashMode === 'len' ? (t === '-' ? 1 : t.length) : 1;
      i++;
    } else if (/^[FB]\d+$/.test(t)) {
      days += 1;
      if (tokens[i + 1] && /^(4|8)s$/.test(tokens[i + 1]!)) i++;
      i++;
    } else if (/^[-–—]*\d+s$/.test(t)) {
      if (dashMode === 'len') {
        const dashPart = t.match(/^[-–—]*/)?.[0] ?? '';
        days += dashPart.length;
      }
      i++;
    } else i++;
  }
  return days;
}

pdf(fs.readFileSync(pdfPath)).then(({ text }) => {
  for (const dashMode of ['len', 'one'] as const) {
    console.log(`\n=== dashMode ${dashMode} ===`);
    for (const { sicil, body } of getEmployeeBlocks(text)) {
      const { name, tokens } = extractTokens(body);
      const days = countDaySlots(tokens, dashMode);
      if (days !== 31) console.log(sicil, name.slice(0, 25), 'days=', days, 'tokens=', tokens.length);
    }
  }
});
