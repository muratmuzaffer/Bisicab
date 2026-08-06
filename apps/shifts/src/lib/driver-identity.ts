export const DRIVER_NAME_KEY = 'bisicab-shift-name';
export const DRIVER_SESSION_KEY = 'bisicab-driver-session';

export function readStoredDriverName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(DRIVER_NAME_KEY)?.trim() ?? '';
}

export function writeStoredDriverName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) {
    localStorage.removeItem(DRIVER_NAME_KEY);
    return;
  }
  localStorage.setItem(DRIVER_NAME_KEY, trimmed);
}

/** Bu tarayıcı oturumunda karşılama tamamlandı mı? */
export function hasCompletedDriverSession(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(DRIVER_SESSION_KEY) === '1';
}

export function markDriverSessionComplete(): void {
  sessionStorage.setItem(DRIVER_SESSION_KEY, '1');
}

export function clearDriverSession(): void {
  sessionStorage.removeItem(DRIVER_SESSION_KEY);
}
