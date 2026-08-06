-- BisiCab - Vardiya pazarı satışlarını değişim geçmişine bağla

alter table public.shift_swaps
  add column if not exists source text not null default 'swap';

alter table public.shift_swaps
  drop constraint if exists shift_swaps_source_check;

alter table public.shift_swaps
  add constraint shift_swaps_source_check
  check (source in ('swap', 'market'));

alter table public.shift_swaps
  add column if not exists market_listing_id uuid;

alter table public.shift_swaps
  add column if not exists sold_price numeric(10, 2);

comment on column public.shift_swaps.source is 'swap = manuel değişim; market = vardiya pazarı satışı';
comment on column public.shift_swaps.market_listing_id is 'Pazar ilanı id (source=market)';
comment on column public.shift_swaps.sold_price is 'Pazar satış tutarı';

create unique index if not exists shift_swaps_market_listing_uidx
  on public.shift_swaps (market_listing_id)
  where market_listing_id is not null;
