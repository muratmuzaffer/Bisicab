-- =============================================================================
-- BisiCab - Aylık vardiya çizelgesi (PDF + yapılandırılmış kayıtlar)
-- Sürücülerin web üzerinden isimle arama yapabilmesi için
-- =============================================================================

create table if not exists public.shift_schedule_months (
  id            uuid primary key default gen_random_uuid(),
  year          integer not null check (year >= 2024 and year <= 2100),
  month         integer not null check (month >= 1 and month <= 12),
  title         text,
  pdf_url       text,
  pdf_filename  text,
  published     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (year, month)
);

comment on table public.shift_schedule_months is 'Aylık vardiya çizelgesi meta verisi ve PDF dosyası.';

create table if not exists public.shift_schedule_entries (
  id                uuid primary key default gen_random_uuid(),
  schedule_month_id uuid not null references public.shift_schedule_months (id) on delete cascade,
  driver_name       text not null,
  shift_date        date not null,
  start_time        time,
  end_time          time,
  duration_hours    smallint not null check (duration_hours in (4, 8)),
  slot_label        text,
  notes             text,
  created_at        timestamptz not null default now()
);

comment on table public.shift_schedule_entries is 'Sürücü vardiya satırları (4s veya 8s).';

create index if not exists shift_schedule_entries_month_idx
  on public.shift_schedule_entries (schedule_month_id);

create index if not exists shift_schedule_entries_date_idx
  on public.shift_schedule_entries (shift_date);

create index if not exists shift_schedule_entries_name_idx
  on public.shift_schedule_entries (driver_name);

-- RLS: herkes yayınlanmış çizelgeleri okuyabilir; yazma sadece admin
alter table public.shift_schedule_months enable row level security;
alter table public.shift_schedule_entries enable row level security;

create policy "shift_schedule_months_public_read"
  on public.shift_schedule_months for select
  using (published = true);

create policy "shift_schedule_entries_public_read"
  on public.shift_schedule_entries for select
  using (
    exists (
      select 1 from public.shift_schedule_months m
      where m.id = schedule_month_id and m.published = true
    )
  );

create policy "shift_schedule_months_admin_all"
  on public.shift_schedule_months for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

create policy "shift_schedule_entries_admin_all"
  on public.shift_schedule_entries for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin'
    )
  );

-- Storage bucket for PDF files (run via Supabase dashboard or CLI if needed)
-- insert into storage.buckets (id, name, public) values ('shift-schedules', 'shift-schedules', true);
