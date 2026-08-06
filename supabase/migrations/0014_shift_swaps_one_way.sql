-- Tablo zaten 0012 ile oluşturulduysa sadece bu satır yeterli.
-- Tablo yoksa önce 0012_shift_swaps.sql çalıştırın.

alter table public.shift_swaps
  alter column requester_date drop not null;
