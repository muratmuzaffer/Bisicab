import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { User } from '@bisicab/shared';
import { supabase } from '@/lib/supabase';
import { resetSessionState } from '@/lib/sessionReset';

let authListenerRegistered = false;

function runRpc(name: 'ensure_driver_profile') {
  void (async () => {
    try {
      await supabase.rpc(name);
    } catch {
      /* opsiyonel */
    }
  })();
}

/** Auth kilidi serbest kalsın diye Supabase çağrılarını callback dışına ertele. */
function afterAuthLock(fn: () => void) {
  setTimeout(fn, 0);
}

async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} zaman aşımı (${ms / 1000}sn)`)),
          ms
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface AuthState {
  session: Session | null;
  profile: User | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: false,
  initialized: false,

  init: async () => {
    try {
      const { data } = await withTimeout(
        supabase.auth.getSession(),
        12_000,
        'Oturum kontrolü'
      );
      set({ session: data.session ?? null, initialized: true });

      if (data.session) {
        afterAuthLock(() => {
          runRpc('ensure_driver_profile');
          void get().fetchProfile(data.session!.user.id);
        });
      }

      if (!authListenerRegistered) {
        authListenerRegistered = true;
        supabase.auth.onAuthStateChange((_event, session) => {
          const prevUserId = get().session?.user?.id ?? null;
          const nextUserId = session?.user?.id ?? null;

          set({ session });
          if (session) {
            if (prevUserId && nextUserId && prevUserId !== nextUserId) {
              afterAuthLock(() => {
                void resetSessionState();
              });
            }
            afterAuthLock(() => {
              runRpc('ensure_driver_profile');
              void get().fetchProfile(session.user.id);
            });
          } else {
            afterAuthLock(() => {
              void resetSessionState();
            });
            set({ profile: null });
          }
        });
      }
    } catch (e) {
      set({
        session: null,
        initialized: true,
      });
      console.warn('[BisiCab] auth init', e);
    }
  },

  fetchProfile: async (userId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      set({ profile: (data as User) ?? null });
    } catch {
      // profil opsiyonel; girişi engellemesin
    }
  },

  signIn: async (email, password) => {
    if (!email || !password) {
      return { error: 'E-posta ve şifre gerekli.' };
    }
    set({ loading: true });
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        20_000,
        'Giriş'
      );
      if (error) return { error: error.message };

      // RPC'yi beklemeyin — auth kilidi / ağ takılırsa spinner sonsuz kalır.
      if (data.session) {
        await resetSessionState();
        set({ session: data.session, initialized: true });
        afterAuthLock(() => {
          runRpc('ensure_driver_profile');
          void get().fetchProfile(data.session!.user.id);
        });
      }
      return {};
    } catch (e) {
      return {
        error:
          e instanceof Error
            ? e.message
            : 'Giriş başarısız. İnternet bağlantınızı kontrol edin.',
      };
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      await withTimeout(supabase.auth.signOut(), 10_000, 'Çıkış');
    } catch {
      // yine de lokal oturumu temizle
    }
    await resetSessionState();
    set({ session: null, profile: null });
  },
}));
