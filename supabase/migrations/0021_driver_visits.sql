-- BisiCab - Sürücü isim seçimi / site girişi kayıtları (admin paneli için)

create table if not exists public.driver_visits (
  id           uuid primary key default gen_random_uuid(),
  driver_name  text not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);

comment on table public.driver_visits is 'Sürücülerin isim seçerek siteye girdiği anlar.';

create index if not exists driver_visits_created_at_idx
  on public.driver_visits (created_at desc);

create index if not exists driver_visits_driver_name_idx
  on public.driver_visits (driver_name);

alter table public.driver_visits enable row level security;

drop policy if exists "driver_visits_public_insert" on public.driver_visits;
create policy "driver_visits_public_insert"
  on public.driver_visits for insert
  with check (true);

drop policy if exists "driver_visits_public_read" on public.driver_visits;
create policy "driver_visits_public_read"
  on public.driver_visits for select
  using (true);
