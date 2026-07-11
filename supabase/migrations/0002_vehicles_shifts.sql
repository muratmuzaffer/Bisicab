-- =============================================================================
-- BisiCab - Araçlar (plaka) ve Mesai (vardiya) katmanı
-- Öğrenci müsait aracı seçip mesaiye başlar; bırakınca araç serbest kalır.
-- Bırakmazsa admin panelinden zorla geri alınabilir. Vardiya kaydı denetim için.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vehicle_status') then
    create type public.vehicle_status as enum ('available', 'in_use', 'maintenance');
  end if;
  if not exists (select 1 from pg_type where typname = 'shift_end_reason') then
    create type public.shift_end_reason as enum ('driver', 'admin_force');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- vehicles : fiziksel fayton bisikletler (plakalı)
-- -----------------------------------------------------------------------------
create table if not exists public.vehicles (
  id                uuid primary key default gen_random_uuid(),
  plate             text not null unique,
  label             text,
  status            public.vehicle_status not null default 'available',
  current_driver_id uuid references public.users (id) on delete set null,
  active_shift_id   uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.vehicles is 'Plakalı elektrikli fayton bisikletler ve anlık durumları.';

-- -----------------------------------------------------------------------------
-- shifts : kim, hangi araç, hangi gün, ne zaman başladı/bitti
-- -----------------------------------------------------------------------------
create table if not exists public.shifts (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.users (id) on delete cascade,
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  end_reason  public.shift_end_reason,
  created_at  timestamptz not null default now()
);

comment on table public.shifts is 'Sürücü mesai (vardiya) kayıtları; araç kullanım denetimi.';

create index if not exists shifts_driver_idx  on public.shifts (driver_id);
create index if not exists shifts_vehicle_idx on public.shifts (vehicle_id);
create index if not exists shifts_active_idx  on public.shifts (driver_id) where ended_at is null;
create index if not exists shifts_started_idx on public.shifts (started_at desc);

-- active_shift_id FK'sini şimdi ekleyebiliriz (shifts tablosu oluştu).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vehicles_active_shift_fk'
  ) then
    alter table public.vehicles
      add constraint vehicles_active_shift_fk
      foreign key (active_shift_id) references public.shifts (id) on delete set null;
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- trips : araç ve vardiya bağlantısı
-- -----------------------------------------------------------------------------
alter table public.trips
  add column if not exists vehicle_id uuid references public.vehicles (id) on delete set null,
  add column if not exists shift_id   uuid references public.shifts (id)   on delete set null;

create index if not exists trips_vehicle_idx on public.trips (vehicle_id);

-- -----------------------------------------------------------------------------
-- Atomik işlemler (SECURITY DEFINER -> RLS'i güvenli biçimde atlar)
-- -----------------------------------------------------------------------------

-- Mesaiye başla: müsait aracı seç, kilitle, ata.
create or replace function public.start_shift(p_vehicle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver uuid := auth.uid();
  v_status public.vehicle_status;
  v_shift  uuid;
begin
  if v_driver is null then
    raise exception 'Giriş gerekli.';
  end if;

  if exists (select 1 from public.shifts where driver_id = v_driver and ended_at is null) then
    raise exception 'Zaten aktif bir mesainiz var.';
  end if;

  select status into v_status from public.vehicles where id = p_vehicle_id for update;
  if v_status is null then
    raise exception 'Araç bulunamadı.';
  end if;
  if v_status <> 'available' then
    raise exception 'Araç şu an müsait değil.';
  end if;

  insert into public.shifts (driver_id, vehicle_id)
  values (v_driver, p_vehicle_id)
  returning id into v_shift;

  update public.vehicles
    set status = 'in_use',
        current_driver_id = v_driver,
        active_shift_id = v_shift,
        updated_at = now()
    where id = p_vehicle_id;

  update public.drivers_profiles
    set is_active = true, updated_at = now()
    where user_id = v_driver;

  return v_shift;
end;
$$;

-- Aracı bırak: sürücünün aktif mesaisini kapat, aracı serbest bırak.
create or replace function public.end_shift()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_driver  uuid := auth.uid();
  v_shift   uuid;
  v_vehicle uuid;
begin
  if v_driver is null then
    raise exception 'Giriş gerekli.';
  end if;

  select id, vehicle_id into v_shift, v_vehicle
  from public.shifts
  where driver_id = v_driver and ended_at is null
  order by started_at desc
  limit 1;

  if v_shift is null then
    return;
  end if;

  update public.shifts
    set ended_at = now(), end_reason = 'driver'
    where id = v_shift;

  update public.vehicles
    set status = 'available', current_driver_id = null, active_shift_id = null, updated_at = now()
    where id = v_vehicle;

  update public.drivers_profiles
    set is_active = false, updated_at = now()
    where user_id = v_driver;
end;
$$;

-- Admin: aracı zorla geri al (sürücü bırakmadıysa).
create or replace function public.admin_release_vehicle(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift  uuid;
  v_driver uuid;
begin
  if not public.is_admin() then
    raise exception 'Yetkisiz işlem.';
  end if;

  select active_shift_id, current_driver_id into v_shift, v_driver
  from public.vehicles where id = p_vehicle_id;

  if v_shift is not null then
    update public.shifts
      set ended_at = coalesce(ended_at, now()), end_reason = 'admin_force'
      where id = v_shift;
  end if;

  update public.vehicles
    set status = 'available', current_driver_id = null, active_shift_id = null, updated_at = now()
    where id = p_vehicle_id;

  if v_driver is not null then
    update public.drivers_profiles
      set is_active = false, updated_at = now()
      where user_id = v_driver;
  end if;
end;
$$;

grant execute on function public.start_shift(uuid) to authenticated;
grant execute on function public.end_shift() to authenticated;
grant execute on function public.admin_release_vehicle(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.vehicles enable row level security;
alter table public.shifts   enable row level security;

-- vehicles: tüm giriş yapmış kullanıcılar listeleyebilir (araç seçimi için).
drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles
  for select to authenticated using (true);

-- vehicles: yalnızca admin ekler/günceller/siler (atama işlemleri RPC ile yapılır).
drop policy if exists vehicles_admin_all on public.vehicles;
create policy vehicles_admin_all on public.vehicles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- shifts: sürücü kendi mesailerini, admin hepsini görür.
drop policy if exists shifts_select on public.shifts;
create policy shifts_select on public.shifts
  for select to authenticated
  using (driver_id = auth.uid() or public.is_admin());

-- -----------------------------------------------------------------------------
-- Realtime (tekrar çalıştırmaya dayanıklı)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'vehicles'
  ) then
    alter publication supabase_realtime add table public.vehicles;
  end if;
end$$;

alter table public.vehicles replica identity full;
