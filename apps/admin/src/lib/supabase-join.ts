export type JoinedUser = {
  full_name?: string | null;
  email?: string | null;
  role?: string;
};

/** Supabase join alanları bazen tek obje, bazen dizi döner. */
export function pickJoinedUser(
  users: JoinedUser | JoinedUser[] | null | undefined
): JoinedUser | null {
  if (!users) return null;
  return Array.isArray(users) ? users[0] ?? null : users;
}

export function isDriverUser(
  users: JoinedUser | JoinedUser[] | null | undefined
): boolean {
  return pickJoinedUser(users)?.role === 'driver';
}

export function pickJoinedRecord<T>(
  value: T | T[] | null | undefined
): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}
