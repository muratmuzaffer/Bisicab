-- =============================================================================
-- BisiCab - Başlangıç şeması
-- İZULAŞ / Alsancak Limanı - Konak Saat Kulesi elektrikli fayton bisiklet hattı
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enum tipleri
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('driver', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'trip_status') then
    create type public.trip_status as enum ('ongoing', 'completed', 'cancelled');
  end if;
end$$;

-- -----------------------------------------------------------------------------
-- users : auth.users ile birebir profil tablosu
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  role        public.user_role not null default 'driver',
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

comment on table public.users is 'Uygulama kullanıcıları (sürücü/öğrenci ve admin).';

-- -----------------------------------------------------------------------------
-- drivers_profiles : sürücüye özel istatistik ve anlık konum
-- -----------------------------------------------------------------------------
create table if not exists public.drivers_profiles (
  user_id         uuid primary key references public.users (id) on delete cascade,
  total_rides     integer not null default 0,
  total_earnings  numeric(12, 2) not null default 0,
  is_active       boolean not null default false,
  current_lat     double precision,
  current_lng     double precision,
  updated_at      timestamptz not null default now()
);

comment on table public.drivers_profiles is 'Sürücü istatistikleri ve canlı konumu.';

-- -----------------------------------------------------------------------------
-- trips : yolculuk kayıtları
-- -----------------------------------------------------------------------------
create table if not exists public.trips (
  id                 uuid primary key default gen_random_uuid(),
  driver_id          uuid not null references public.users (id) on delete cascade,
  start_lat          double precision,
  start_lng          double precision,
  end_lat            double precision,
  end_lng            double precision,
  total_distance     numeric(10, 3) not null default 0,   -- km
  total_duration     numeric(10, 2) not null default 0,   -- dakika
  total_amount       numeric(12, 2) not null default 0,   -- TL
  status             public.trip_status not null default 'ongoing',
  receipt_image_url  text,
  created_at         timestamptz not null default now(),
  ended_at           timestamptz
);

comment on table public.trips is 'Yolculuk kayıtları, mesafe/süre/tutar ve fiş görseli.';

create index if not exists trips_driver_id_idx on public.trips (driver_id);
create index if not exists trips_status_idx    on public.trips (status);
create index if not exists trips_created_at_idx on public.trips (created_at desc);

-- -----------------------------------------------------------------------------
-- Trigger: yeni auth kullanıcısı -> public.users + (sürücüyse) profil
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  v_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'driver');

  insert into public.users (id, email, role, full_name, phone, avatar_url)
  values (
    new.id,
    new.email,
    v_role,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  if v_role = 'driver' then
    insert into public.drivers_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Trigger: trip 'completed' olduğunda sürücü istatistiklerini güncelle
-- -----------------------------------------------------------------------------
create or replace function public.on_trip_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed'
     and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    update public.drivers_profiles
      set total_rides    = total_rides + 1,
          total_earnings = total_earnings + coalesce(new.total_amount, 0),
          updated_at     = now()
      where user_id = new.driver_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_trip_completed on public.trips;
create trigger trg_trip_completed
  after insert or update of status on public.trips
  for each row execute function public.on_trip_completed();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.drivers_profiles enable row level security;
alter table public.trips            enable row level security;

-- Admin kontrol yardımcı fonksiyonu (RLS içinde tekrar sorgu yapmamak için).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

-- users politikaları
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (id = auth.uid() or public.is_admin());

drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- drivers_profiles politikaları
drop policy if exists driver_profile_select on public.drivers_profiles;
create policy driver_profile_select on public.drivers_profiles
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists driver_profile_update on public.drivers_profiles;
create policy driver_profile_update on public.drivers_profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- trips politikaları
drop policy if exists trips_driver_select on public.trips;
create policy trips_driver_select on public.trips
  for select using (driver_id = auth.uid() or public.is_admin());

drop policy if exists trips_driver_insert on public.trips;
create policy trips_driver_insert on public.trips
  for insert with check (driver_id = auth.uid());

drop policy if exists trips_driver_update on public.trips;
create policy trips_driver_update on public.trips
  for update using (driver_id = auth.uid()) with check (driver_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Realtime yayını (yolcu tableti ve admin canlı takip için)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.drivers_profiles;

-- Realtime'ın eski/yeni satırları eşleştirebilmesi için tam replica identity.
alter table public.trips            replica identity full;
alter table public.drivers_profiles replica identity full;

-- -----------------------------------------------------------------------------
-- Storage: fiş fotoğrafları için bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Sürücü yalnızca kendi klasörüne (receipts/<driver_id>/...) yükleyebilir.
drop policy if exists receipts_driver_insert on storage.objects;
create policy receipts_driver_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
