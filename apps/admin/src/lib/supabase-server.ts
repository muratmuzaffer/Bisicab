import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Sunucu bileşenleri / route handler'lar için Supabase istemcisi (cookie tabanlı oturum). */
export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Sunucu bileşeninden çağrıldığında set edilemeyebilir; middleware yeniler.
          }
        },
      },
    }
  );
}
