import fs from 'fs';
import pdf from 'pdf-parse';

const pdfPath = 'C:\\Users\\ma727\\OneDrive\\Masaüstü\\Vardiya_Temmuz_2026 (4).pdf';

function getEmployeeBlocks(text: string) {
  const main = text.split(/Vardiya Dagilimi Ozeti/i)[0] ?? text;
  const blocks: Array<{ sicil: string; body: string; targetHours: number }> = [];
  const re = /(\d{4})([\s\S]*?)(?=\d{4}(?:[A-Za-zİıĞğÜüŞşÖöÇç]|\s*\n)|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(main)) !== null) {
    if (parseInt(m[1]!, 10) < 5710) continue;
    const body = m[2] ?? '';
    const hourMatches = [...body.matchAll(/(\d{2,})s/g)].map((x) => +x[1]!);
    const targetHours = hourMatches.length ? hourMatches[hourMatches.length - 1]! : 0;
    blocks.push({ sicil: m[1]!, body, targetHours });
  }
  return blocks;
}

function extractTokens(body: string, paddingLen: number) {
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
        if (line.length < paddingLen) tokens.push(line);
      } else if (/^\d+s$/.test(line)) continue;
      else {
        const dm = line.match(/([-–—]+)$/);
        const dlen = dm?.[1]?.length ?? 0;
        if (dlen > 0 && dlen < paddingLen) leadingOff += dlen;
        nameParts.push(line.replace(/[-–—]+$/g, '').trim());
      }
    } else if (!/^\d+s$/.test(line)) {
      if (/^[-–—]+$/.test(line) && line.length >= paddingLen) continue;
      if (/^[-–—]*\d+s$/.test(line)) continue;
      tokens.push(line);
    }
  }
  return { name: nameParts.join(' '), leadingOff, tokens };
}

function computeHours(leadingOff: number, tokens: string[]) {
  let hours = 0;
  let i = 0;
  let day = 1;
  const maxDay = 31;

  while (day <= leadingOff && day <= maxDay) day++;

  while (i < tokens.length && day <= maxDay) {
    const t = tokens[i]!;
    if (/^[-–—]+$/.test(t) || t === '-') { day++; i++; continue; }
    if (/^[FB]\d+$/.test(t)) {
      let h: 4 | 8 = t.startsWith('B') ? 8 : 4;
      if (tokens[i + 1] && /^(4|8)s$/.test(tokens[i + 1]!)) {
        h = tokens[i + 1]!.startsWith('8') ? 8 : 4;
        i++;
      }
      hours += h;
      day++;
      i++;
      continue;
    }
    i++;
  }
  return hours;
}

pdf(fs.readFileSync(pdfPath)).then(({ text }) => {
  for (const paddingLen of [5, 6, 7, 8, 10, 13]) {
    let matches = 0;
    for (const { sicil, body, targetHours } of getEmployeeBlocks(text)) {
      const { leadingOff, tokens } = extractTokens(body, paddingLen);
      const hours = computeHours(leadingOff, tokens);
      if (hours === targetHours) matches++;
      else if (paddingLen === 6) console.log('MISMATCH', sicil, 'got', hours, 'want', targetHours, 'lead', leadingOff);
    }
    console.log(`paddingLen=${paddingLen} hour matches: ${matches}/25`);
  }
});
