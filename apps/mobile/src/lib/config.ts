/** Ortam değişkenlerinden okunan istemci yapılandırması. */
export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapboxToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '',
};

if (__DEV__) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn(
      '[BisiCab] EXPO_PUBLIC_SUPABASE_URL / ANON_KEY tanımlı değil. .env dosyasını doldurun.'
    );
  }
}
