import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { User } from '@bisicab/shared';
import { supabase } from '@/lib/supabase';

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
    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) {
      await get().fetchProfile(data.session.user.id);
    }
    set({ initialized: true });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        void get().fetchProfile(session.user.id);
      } else {
        set({ profile: null });
      }
    });
  },

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    set({ profile: (data as User) ?? null });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    return error ? { error: error.message } : {};
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));
