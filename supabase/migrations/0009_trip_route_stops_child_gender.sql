-- Çoklu durak güzergahı + çocuk cinsiyeti
alter table public.trips
  add column if not exists route_stops text[] default null,
  add column if not exists passenger_child_male smallint not null default 0,
  add column if not exists passenger_child_female smallint not null default 0;

comment on column public.trips.route_stops is 'Sıralı durak id listesi (en fazla 6).';
comment on column public.trips.passenger_child_male is 'Erkek çocuk yolcu sayısı.';
comment on column public.trips.passenger_child_female is 'Kız çocuk yolcu sayısı.';
