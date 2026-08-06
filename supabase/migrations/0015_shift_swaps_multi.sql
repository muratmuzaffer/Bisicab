-- Çoklu vardiya değişimi (ör. 1×8s ↔ 2×4s)

alter table public.shift_swaps
  add column if not exists requester_shifts jsonb not null default '[]'::jsonb,
  add column if not exists partner_shifts jsonb not null default '[]'::jsonb;
