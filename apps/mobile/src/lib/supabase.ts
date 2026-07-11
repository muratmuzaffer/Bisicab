import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

function createSupabase(): SupabaseClient {
  const url = config.supabaseUrl || 'https://placeholder.supabase.co';
  const key = config.supabaseAnonKey || 'placeholder-anon-key';
  return createClient(url, key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 5 },
    },
  });
}

export const supabase = createSupabase();
