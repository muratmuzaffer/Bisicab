import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'shifts-admin';

export function isAdminAuthed(): boolean {
  return cookies().get(ADMIN_COOKIE_NAME)?.value === '1';
}
