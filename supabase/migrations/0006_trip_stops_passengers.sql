-- =============================================================================
-- BisiCab - Durak + yolcu + turist bilgisi
-- =============================================================================

alter table public.trips
  add column if not exists start_stop text,
  add column if not exists end_stop text,
  add column if not exists passenger_male smallint not null default 0,
  add column if not exists passenger_female smallint not null default 0,
  add column if not exists passenger_child smallint not null default 0,
  add column if not exists has_tourist boolean not null default false;

comment on column public.trips.start_stop is 'Başlangıç durağı id (örn. alsancak-iskele).';
comment on column public.trips.end_stop is 'Varış durağı id.';
comment on column public.trips.passenger_male is 'Yetişkin erkek yolcu sayısı.';
comment on column public.trips.passenger_female is 'Yetişkin kadın yolcu sayısı.';
comment on column public.trips.passenger_child is 'Çocuk yolcu sayısı.';
comment on column public.trips.has_tourist is 'Turist yolcu var mı?';
