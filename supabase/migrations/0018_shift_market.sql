-- BisiCab - Vardiya pazarı: sürücüler vardiyalarını bir taban fiyatla ilana koyar,
-- diğer sürücüler taban fiyatın altına düşmeyen teklifler verir.

create table if not exists public.shift_market_listings (
  id              uuid primary key default gen_random_uuid(),
  seller_name     text not null,
  shift_date      date not null,
  slot_label      text,
  start_time      time,
  end_time        time,
  duration_hours  smallint not null default 8,
  min_price       numeric(10, 2) not null check (min_price >= 0),
  note            text,
  status          text not null default 'open' check (status in ('open', 'sold', 'cancelled')),
  sold_to_name    text,
  sold_price      numeric(10, 2),
  created_at      timestamptz not null default now()
);

comment on table public.shift_market_listings is 'Vardiya pazarı ilanları (post-it panosu).';
comment on column public.shift_market_listings.min_price is 'Taban fiyat; teklifler bu tutarın altında olamaz.';

create index if not exists shift_market_listings_created_at_idx
  on public.shift_market_listings (created_at desc);
create index if not exists shift_market_listings_status_idx
  on public.shift_market_listings (status);
create index if not exists shift_market_listings_shift_date_idx
  on public.shift_market_listings (shift_date);

create table if not exists public.shift_market_offers (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.shift_market_listings (id) on delete cascade,
  bidder_name text not null,
  amount      numeric(10, 2) not null check (amount > 0),
  note        text,
  created_at  timestamptz not null default now()
);

comment on table public.shift_market_offers is 'Vardiya pazarı ilanlarına verilen fiyat teklifleri.';

create index if not exists shift_market_offers_listing_idx
  on public.shift_market_offers (listing_id, amount desc);

-- Taban fiyat ve ilan durumu veritabanı seviyesinde de korunur.
create or replace function public.check_shift_market_offer()
returns trigger
language plpgsql
as $$
declare
  listing public.shift_market_listings;
begin
  select * into listing
  from public.shift_market_listings
  where id = new.listing_id;

  if not found then
    raise exception 'İlan bulunamadı';
  end if;

  if listing.status <> 'open' then
    raise exception 'İlan artık teklife açık değil';
  end if;

  if new.amount < listing.min_price then
    raise exception 'Teklif en az % TL olmalı', listing.min_price;
  end if;

  if lower(btrim(new.bidder_name)) = lower(btrim(listing.seller_name)) then
    raise exception 'Kendi ilanınıza teklif veremezsiniz';
  end if;

  return new;
end;
$$;

drop trigger if exists shift_market_offers_check on public.shift_market_offers;
create trigger shift_market_offers_check
  before insert or update on public.shift_market_offers
  for each row execute function public.check_shift_market_offer();

-- Uygulama isim tabanlı çalışıyor (Supabase auth yok); shift_swaps ile aynı erişim modeli.
alter table public.shift_market_listings enable row level security;
alter table public.shift_market_offers enable row level security;

drop policy if exists "shift_market_listings_public_read" on public.shift_market_listings;
create policy "shift_market_listings_public_read"
  on public.shift_market_listings for select
  using (true);

drop policy if exists "shift_market_listings_public_insert" on public.shift_market_listings;
create policy "shift_market_listings_public_insert"
  on public.shift_market_listings for insert
  with check (true);

drop policy if exists "shift_market_listings_public_update" on public.shift_market_listings;
create policy "shift_market_listings_public_update"
  on public.shift_market_listings for update
  using (true)
  with check (true);

drop policy if exists "shift_market_listings_public_delete" on public.shift_market_listings;
create policy "shift_market_listings_public_delete"
  on public.shift_market_listings for delete
  using (true);

drop policy if exists "shift_market_offers_public_read" on public.shift_market_offers;
create policy "shift_market_offers_public_read"
  on public.shift_market_offers for select
  using (true);

drop policy if exists "shift_market_offers_public_insert" on public.shift_market_offers;
create policy "shift_market_offers_public_insert"
  on public.shift_market_offers for insert
  with check (true);

drop policy if exists "shift_market_offers_public_delete" on public.shift_market_offers;
create policy "shift_market_offers_public_delete"
  on public.shift_market_offers for delete
  using (true);
