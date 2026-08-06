-- Vardiya pazarı ilanlarına IBAN (ödeme hesabı)

alter table public.shift_market_listings
  add column if not exists iban text;

comment on column public.shift_market_listings.iban is 'Satıcının IBAN numarası; teklif kabulünde ödeme için.';
