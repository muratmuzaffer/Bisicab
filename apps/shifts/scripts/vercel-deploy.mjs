import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shiftsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(shiftsRoot, '../..');
const envPath = path.join(shiftsRoot, '.env.local');

function loadEnv(filePath) {
  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const index = line.indexOf('=');
        const key = line.slice(0, index);
        let value = line.slice(index + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        return [key, value];
      })
  );
}

const env = loadEnv(envPath);
const keys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SHIFTS_ADMIN_PASSWORD',
];

for (const key of keys) {
  if (!env[key]) {
    console.error(`Missing ${key} in apps/shifts/.env.local`);
    process.exit(1);
  }
  for (const target of ['production', 'preview', 'development']) {
    const result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', key, target, '--force', '--yes', '--project', 'bisicab-shifts'],
      {
        cwd: repoRoot,
        input: `${env[key]}\n`,
        stdio: ['pipe', 'inherit', 'inherit'],
        shell: true,
      }
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

const deploy = spawnSync(
  'npx',
  [
    'vercel',
    'deploy',
    '--prod',
    '--yes',
    '--project',
    'bisicab-shifts',
    '--local-config',
    'apps/shifts/vercel.json',
  ],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  }
);

process.exit(deploy.status ?? 1);
