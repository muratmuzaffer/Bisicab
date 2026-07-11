-- =============================================================================
-- BisiCab - Demo veri (admin panelini hızlı test etmek için)
-- SQL Editor'e yapıştırıp Run edin. Önce en az bir SÜRÜCÜ kullanıcısı
-- (Authentication > Users) oluşturulmuş olmalı.
-- =============================================================================
do $$
declare
  v_driver uuid;
begin
  -- İlk sürücü profilini seç.
  select user_id into v_driver from public.drivers_profiles limit 1;

  if v_driver is null then
    raise notice 'Önce bir sürücü kullanıcısı oluşturun (Authentication > Users), sonra tekrar çalıştırın.';
    return;
  end if;

  -- Canlı takip için: sürücüyü aktif yap + İzmir/Alsancak yakınına konumla.
  update public.drivers_profiles
    set is_active   = true,
        current_lat = 38.4370,
        current_lng = 27.1430,
        updated_at  = now()
    where user_id = v_driver;

  -- Demo tamamlanmış yolculuklar (ücret motoruyla uyumlu tutarlar).
  insert into public.trips
    (driver_id, start_lat, start_lng, end_lat, end_lng,
     total_distance, total_duration, total_amount, status, created_at, ended_at)
  values
    (v_driver, 38.4430, 27.1440, 38.4180, 27.1290,
     1.8,  9.0, 185.0,  'completed', now() - interval '2 hours',  now() - interval '110 minutes'),
    (v_driver, 38.4430, 27.1440, 38.4000, 27.1100,
     4.0, 22.0, 252.5,  'completed', now() - interval '1 hour',   now() - interval '40 minutes'),
    (v_driver, 38.4430, 27.1440, 38.4300, 27.1350,
     0.9,  5.0, 185.0,  'completed', now() - interval '20 minutes', now() - interval '15 minutes');

  raise notice 'Demo veri eklendi. Sürücü: %', v_driver;
end $$;
