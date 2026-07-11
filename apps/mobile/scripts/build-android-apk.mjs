import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const androidDir = path.join(mobileRoot, 'android');
const isWin = process.platform === 'win32';
const gradlew = isWin ? 'gradlew.bat' : './gradlew';

const env = {
  ...process.env,
  EXPO_NO_METRO_WORKSPACE_ROOT: '1',
};

console.log('Building release APK (monorepo-safe Metro root)...');

execSync(`${gradlew} --stop`, { cwd: androidDir, stdio: 'inherit', env, shell: isWin });
execSync(`${gradlew} assembleRelease --no-daemon --no-configuration-cache`, {
  cwd: androidDir,
  stdio: 'inherit',
  env,
  shell: isWin,
});

const apk = path.join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);
console.log(`\nAPK ready:\n${apk}\n`);
