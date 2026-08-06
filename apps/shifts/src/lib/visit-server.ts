import { createClient } from '@supabase/supabase-js';
import { createLocalVisit, listLocalVisits } from './local-visit-store';
import type { DriverVisit } from './visit-types';

const TABLE = 'driver_visits';

function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function canUseLocalFallback(): boolean {
  return !process.env.VERCEL;
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return (
    error?.code === '42P01' ||
    error?.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(error?.message ?? '')
  );
}

function mapVisit(row: Record<string, unknown>): DriverVisit {
  return {
    id: row.id as string,
    driverName: row.driver_name as string,
    userAgent: (row.user_agent as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

export async function logDriverVisit(
  driverName: string,
  userAgent?: string | null
): Promise<DriverVisit> {
  const name = driverName.trim();
  if (!name) throw new Error('İsim gerekli');

  const ua = userAgent?.trim().slice(0, 300) || null;

  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) throw new Error('Supabase yapılandırılmamış');
    return createLocalVisit(name, ua);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ driver_name: name, user_agent: ua })
    .select('*')
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        'Giriş kayıt tablosu yok. Supabase’de 0021_driver_visits.sql migration’ını çalıştırın.'
      );
    }
    if (canUseLocalFallback()) return createLocalVisit(name, ua);
    throw new Error(error.message ?? 'Giriş kaydedilemedi');
  }

  return mapVisit(data as Record<string, unknown>);
}

export async function fetchDriverVisits(limit = 100): Promise<DriverVisit[]> {
  if (!isSupabaseConfigured()) {
    if (!canUseLocalFallback()) return [];
    return listLocalVisits(limit);
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingTableError(error)) {
      throw new Error(
        'Giriş kayıt tablosu yok. Supabase’de 0021_driver_visits.sql migration’ını çalıştırın.'
      );
    }
    if (canUseLocalFallback()) return listLocalVisits(limit);
    throw new Error(error.message ?? 'Girişler yüklenemedi');
  }

  return (data as Record<string, unknown>[]).map(mapVisit);
}
