/**
 * Vardiya pazarı (/pazar) menü bağlantısını ekler.
 *
 * Pazar özelliği kendi dosyalarında durur; tek gereken menüye bir giriş
 * eklemek. Menü iki farklı şekilde kurulmuş olabildiği için betik ikisini de
 * destekler:
 *
 *   1. app-nav.tsx içindeki APP_NAV_ITEMS listesi (mobil alt menülü sürüm)
 *   2. schedule-client / swap-client içindeki AppShell nav prop'u (eski sürüm)
 *
 * Aynı komutu birden fazla kez çalıştırmak güvenlidir; zaten ekliyse dokunmaz.
 *
 * Kullanım:  node scripts/add-pazar-menu.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const componentsDir = path.join(repoRoot, 'apps/shifts/src/components');

const APP_NAV = path.join(componentsDir, 'app-nav.tsx');
const APP_SHELL = path.join(componentsDir, 'app-shell.tsx');
const SCHEDULE_CLIENT = path.join(componentsDir, 'schedule-client.tsx');
const SWAP_CLIENT = path.join(componentsDir, 'swap-client.tsx');

const changed = [];
const skipped = [];

function read(file) {
  return readFileSync(file, 'utf8');
}

function write(file, contents) {
  writeFileSync(file, contents, 'utf8');
  changed.push(path.relative(repoRoot, file));
}

/** lucide-react import listesine bir ikon ekler. */
function addLucideImport(source, icon) {
  // [^}] kullanılır: aksi halde eşleşme önceki import bloklarını da yutar.
  const match = source.match(/import\s*\{([^}]*)\}\s*from\s*'lucide-react';/);
  if (!match) return null;

  const names = match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.some((name) => name === icon)) return source;

  // "type LucideIcon" gibi girişler her zaman sonda kalsın.
  const typeEntries = names.filter((name) => name.startsWith('type '));
  const plain = names.filter((name) => !name.startsWith('type '));
  plain.push(icon);
  plain.sort((a, b) => a.localeCompare(b));

  const rebuilt = [...plain, ...typeEntries].map((name) => `  ${name},`).join('\n');
  return source.replace(match[0], `import {\n${rebuilt}\n} from 'lucide-react';`);
}

function patchAppNav() {
  let source = read(APP_NAV);

  if (source.includes("'/pazar'")) {
    skipped.push('app-nav.tsx (menü girişi zaten var)');
    return true;
  }

  const withImport = addLucideImport(source, 'Store');
  if (withImport === null) {
    console.error('app-nav.tsx içinde lucide-react import bloğu bulunamadı.');
    return false;
  }
  source = withImport;

  const arrayStart = source.indexOf('APP_NAV_ITEMS');
  if (arrayStart < 0) {
    console.error('app-nav.tsx içinde APP_NAV_ITEMS bulunamadı.');
    return false;
  }

  const arrayEnd = source.indexOf('];', arrayStart);
  if (arrayEnd < 0) {
    console.error('APP_NAV_ITEMS listesinin sonu bulunamadı.');
    return false;
  }

  // Değişim sekmesinden önce, yoksa listenin sonuna ekle.
  const entry =
    "  { href: '/pazar', label: 'Vardiya pazarı', shortLabel: 'Pazar', icon: Store },\n";
  const swapLine = source.lastIndexOf("{ href: '/degisim'", arrayEnd);

  if (swapLine > arrayStart) {
    const lineStart = source.lastIndexOf('\n', swapLine) + 1;
    source = source.slice(0, lineStart) + entry + source.slice(lineStart);
  } else {
    source = source.slice(0, arrayEnd) + entry + source.slice(arrayEnd);
  }

  write(APP_NAV, source);
  return true;
}

/** Mobil alt menü 3 sekme için sabitlenmişse 4 sekmeye genişletir. */
function widenMobileNavGrid() {
  if (!existsSync(APP_SHELL)) return;

  const source = read(APP_SHELL);
  const lines = source.split('\n');
  let touched = false;

  const next = lines.map((line) => {
    if (line.includes('grid-cols-3') && line.includes('max-w-lg')) {
      touched = true;
      return line.replace('grid-cols-3', 'grid-cols-4');
    }
    return line;
  });

  if (touched) {
    write(APP_SHELL, next.join('\n'));
  } else {
    skipped.push('app-shell.tsx (mobil menü sütun sayısı değişmedi)');
  }
}

/** Eski kurulum: AppShell'e nav prop'u geçen sayfalara giriş ekler. */
function patchNavProp(file, afterHref) {
  if (!existsSync(file)) return true;

  let source = read(file);
  const name = path.basename(file);

  if (source.includes("href: '/pazar'")) {
    skipped.push(`${name} (menü girişi zaten var)`);
    return true;
  }

  const navStart = source.indexOf('nav={[');
  if (navStart < 0) {
    skipped.push(`${name} (nav prop kullanmıyor)`);
    return true;
  }

  const withImport = addLucideImport(source, 'Store');
  if (withImport === null) {
    console.error(`${name} içinde lucide-react import bloğu bulunamadı.`);
    return false;
  }
  source = withImport;

  const anchor = source.indexOf(`href: '${afterHref}'`);
  const insertAt =
    anchor > 0
      ? source.indexOf('},', anchor) + '},\n'.length
      : source.indexOf('nav={[') + 'nav={[\n'.length;

  const entry = [
    '        {',
    "          href: '/pazar',",
    "          label: 'Pazar',",
    '          icon: <Store className="h-4 w-4" />,',
    '        },',
    '',
  ].join('\n');

  source = source.slice(0, insertAt) + entry + source.slice(insertAt);
  write(file, source);
  return true;
}

function main() {
  let ok = true;

  if (existsSync(APP_NAV)) {
    ok = patchAppNav();
    if (ok) widenMobileNavGrid();
  } else {
    ok = patchNavProp(SCHEDULE_CLIENT, '/degisim') && patchNavProp(SWAP_CLIENT, '/');
  }

  if (!ok) {
    console.error('\nMenü girişi otomatik eklenemedi. Menüye elle şu satırı ekleyin:');
    console.error("  { href: '/pazar', label: 'Vardiya pazarı', icon: Store }");
    process.exit(1);
  }

  if (changed.length > 0) {
    console.log('Güncellenen dosyalar:');
    for (const file of changed) console.log(`  ${file}`);
  }
  if (skipped.length > 0) {
    console.log('Atlanan:');
    for (const note of skipped) console.log(`  ${note}`);
  }
  if (changed.length === 0) {
    console.log('Menüde değişiklik gerekmedi.');
  }
  console.log('\nPazar menüsü hazır.');
}

main();
