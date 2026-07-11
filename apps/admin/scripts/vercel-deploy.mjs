import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = path.join(repoRoot, 'apps/admin/.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      const key = line.slice(0, index);
      let value = line.slice(index + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      return [key, value];
    })
);

const keys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_MAPBOX_TOKEN',
];

for (const key of keys) {
  if (!env[key]) {
    console.error(`Missing ${key} in .env.local`);
    process.exit(1);
  }
  for (const target of ['production', 'preview', 'development']) {
    const result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', key, target, '--force', '--yes'],
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

const deploy = spawnSync('npx', ['vercel', 'deploy', '--prod', '--yes'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});

process.exit(deploy.status ?? 1);
