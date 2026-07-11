/**
 * BisiCab test kullanıcıları oluşturur.
 *
 * Kullanım (service role ile — önerilen):
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
 *   node scripts/seed-users.mjs
 *
 * Service role: Supabase Dashboard → Project Settings → API → service_role (secret)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(resolve(root, 'apps/admin/.env.local'));
loadEnvFile(resolve(root, 'apps/mobile/.env'));

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'Eksik ortam değişkeni.\n' +
      '  SUPABASE_URL (veya NEXT_PUBLIC_SUPABASE_URL)\n' +
      '  SUPABASE_SERVICE_ROLE_KEY\n\n' +
      'Service role: Dashboard → Project Settings → API → service_role'
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Supabase minimum 6 karakter ister; 12345 reddedilir. */
const PASSWORD = '123456';

const ADMIN = {
  email: 'murat.muzaffer@izulas.com',
  password: PASSWORD,
  fullName: 'Murat Muzaffer',
  role: 'admin',
};

const DRIVERS = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return {
    email: `surucu${n}@izulas.com`,
    password: PASSWORD,
    fullName: `Sürücü ${n}`,
    role: 'driver',
  };
});

async function upsertUser({ email, password, fullName, role }) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    const { error: updateError } = await admin.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        user_metadata: { role, full_name: fullName },
      }
    );
    if (updateError) throw updateError;

    const { error: roleError } = await admin
      .from('users')
      .update({ role, full_name: fullName })
      .eq('id', existing.id);
  if (roleError) throw roleError;

  if (role === 'driver') {
    await admin
      .from('drivers_profiles')
      .upsert({ user_id: existing.id }, { onConflict: 'user_id' });
  }

  return { email, status: 'güncellendi', id: existing.id };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: fullName },
  });
  if (error) throw error;

  const { error: roleError } = await admin
    .from('users')
    .update({ role, full_name: fullName })
    .eq('id', data.user.id);
  if (roleError) throw roleError;

  if (role === 'driver') {
    await admin
      .from('drivers_profiles')
      .upsert({ user_id: data.user.id }, { onConflict: 'user_id' });
  }

  return { email, status: 'oluşturuldu', id: data.user.id };
}

async function demoteOtherAdmins(keepEmail) {
  const { data, error } = await admin
    .from('users')
    .select('id, email, role')
    .eq('role', 'admin');
  if (error) throw error;

  const toDemote = (data ?? []).filter(
    (u) => u.email?.toLowerCase() !== keepEmail.toLowerCase()
  );

  for (const u of toDemote) {
    await admin.from('users').update({ role: 'driver' }).eq('id', u.id);
    await admin.auth.admin.updateUserById(u.id, {
      user_metadata: { role: 'driver' },
    });
    console.log(`  ↳ admin → driver: ${u.email}`);
  }
}

console.log('BisiCab kullanıcıları oluşturuluyor...\n');

const results = [];

for (const user of [...DRIVERS, ADMIN]) {
  try {
    const r = await upsertUser(user);
    results.push(r);
    console.log(`✓ ${r.email} (${r.status})`);
  } catch (e) {
    console.error(`✗ ${user.email}:`, e.message ?? e);
    process.exitCode = 1;
  }
}

if (process.exitCode) {
  console.error('\nBazı hesaplar oluşturulamadı. Yukarıdaki hataları düzeltip tekrar çalıştırın.');
  process.exit(process.exitCode);
}

console.log('\nDiğer admin hesapları sürücüye çevriliyor...');
await demoteOtherAdmins(ADMIN.email);

console.log('\n--- Özet ---');
console.log(`Admin panel: murat.muzaffer@izulas.com / ${PASSWORD}`);
console.log(`Sürücüler:   surucu01@izulas.com … surucu10@izulas.com / ${PASSWORD}`);
console.log('\nMobil test için yalnızca surucuXX hesaplarını kullanın.');
console.log('Admin panel için murat.muzaffer@izulas.com kullanın.');
