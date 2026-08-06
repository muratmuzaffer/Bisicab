-- BisiCab - Sürücü vardiya değişim kayıtları
-- (requester_date nullable = karşılıksız vardiya alımı)

create table if not exists public.shift_swaps (
  id              uuid primary key default gen_random_uuid(),
  requester_name  text not null,
  partner_name    text not null,
  requester_date  date,
  partner_date    date not null,
  requester_slot  text,
  partner_slot    text,
  requester_shifts jsonb not null default '[]'::jsonb,
  partner_shifts   jsonb not null default '[]'::jsonb,
  note            text,
  created_at      timestamptz not null default now()
);

comment on table public.shift_swaps is 'Sürücüler arası vardiya değişim kayıtları.';

create index if not exists shift_swaps_created_at_idx on public.shift_swaps (created_at desc);
create index if not exists shift_swaps_requester_idx on public.shift_swaps (requester_name);
create index if not exists shift_swaps_partner_idx on public.shift_swaps (partner_name);

alter table public.shift_swaps enable row level security;

drop policy if exists "shift_swaps_public_read" on public.shift_swaps;
create policy "shift_swaps_public_read"
  on public.shift_swaps for select
  using (true);

drop policy if exists "shift_swaps_public_insert" on public.shift_swaps;
create policy "shift_swaps_public_insert"
  on public.shift_swaps for insert
  with check (true);

-- Eski tabloda requester_date zorunluysa gevşet
alter table public.shift_swaps
  alter column requester_date drop not null;
