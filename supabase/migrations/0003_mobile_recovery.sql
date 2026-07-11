-- =============================================================================
-- BisiCab - Mobil kurtarma: profil oluşturma + aktif mesai okuma
-- =============================================================================

-- Auth kullanıcısı var ama public.users satırı yoksa oluştur (manuel kayıt vb.).
create or replace function public.ensure_driver_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'Giriş gerekli.';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.users (id, email, role, full_name)
  values (
    v_uid,
    coalesce(v_email, ''),
    'driver',
    null
  )
  on conflict (id) do nothing;

  insert into public.drivers_profiles (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;
end;
$$;

-- Aktif mesaiyi güvenilir şekilde döndür (RLS/join sorunlarını atlar).
create or replace function public.get_my_active_shift()
returns table (
  shift_id uuid,
  vehicle_id uuid,
  plate text,
  label text,
  started_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.id, s.vehicle_id, v.plate, v.label, s.started_at
  from public.shifts s
  join public.vehicles v on v.id = s.vehicle_id
  where s.driver_id = auth.uid()
    and s.ended_at is null
  order by s.started_at desc
  limit 1;
$$;

grant execute on function public.ensure_driver_profile() to authenticated;
grant execute on function public.get_my_active_shift() to authenticated;
