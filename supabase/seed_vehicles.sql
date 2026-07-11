-- BisiCab - Örnek araçlar (plakalı fayton bisikletler)
-- SQL Editor'e yapıştırıp Run edin. Tekrar çalıştırmak güvenlidir (plate unique).
insert into public.vehicles (plate, label) values
  ('35 BC 001', 'Alsancak-1'),
  ('35 BC 002', 'Alsancak-2'),
  ('35 BC 003', 'Konak-1'),
  ('35 BC 004', 'Konak-2'),
  ('35 BC 005', 'Kordon-1')
on conflict (plate) do nothing;
