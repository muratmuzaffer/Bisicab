-- =============================================================================
-- BisiCab - Yolculuk güzergahı (başlangıç / varış bölgesi)
-- =============================================================================

alter table public.trips
  add column if not exists start_zone text,
  add column if not exists end_zone text;

comment on column public.trips.start_zone is 'Başlangıç bölgesi (alsancak, kultur, akdeniz, konak, kulturpark).';
comment on column public.trips.end_zone is 'Varış bölgesi.';
