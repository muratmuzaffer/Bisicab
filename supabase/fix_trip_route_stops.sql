-- Supabase SQL Editor'da TEK SEFERDE çalıştırın.
-- Yolculuk tamamlama: route_stops + çocuk cinsiyeti kolonları

alter table public.trips
  add column if not exists route_stops text[] default null,
  add column if not exists passenger_child_male smallint not null default 0,
  add column if not exists passenger_child_female smallint not null default 0;

-- Kolon adları (dikkat: passenger_CHILD_female — "child" tam yazılır)
comment on column public.trips.route_stops is 'Sıralı durak id listesi (en fazla 6).';
comment on column public.trips.passenger_child_male is 'Erkek çocuk yolcu sayısı.';
comment on column public.trips.passenger_child_female is 'Kız çocuk yolcu sayısı.';

-- API şema önbelleğini hemen yenile (PGRST204 / schema cache hatasını önler)
notify pgrst, 'reload schema';
