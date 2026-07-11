-- =============================================================================
-- Canlı harita: eksik sürücü profilleri + takılı araçları temizle
-- Supabase SQL Editor'de çalıştırın.
-- =============================================================================

-- 1) Sürücü rolünde olup drivers_profiles satırı olmayanları ekle
INSERT INTO public.drivers_profiles (user_id)
SELECT u.id
FROM public.users u
WHERE u.role = 'driver'
  AND NOT EXISTS (
    SELECT 1 FROM public.drivers_profiles dp WHERE dp.user_id = u.id
  );

-- 2) Admin hesaplarını haritadan çıkar (is_active kapat)
UPDATE public.drivers_profiles dp
SET is_active = false, updated_at = now()
FROM public.users u
WHERE u.id = dp.user_id
  AND u.role = 'admin';

-- 3) Mesaisi bitmiş / pasif sürücülerde takılı kalan araçları serbest bırak
UPDATE public.vehicles v
SET
  status = 'available',
  current_driver_id = null,
  active_shift_id = null,
  updated_at = now()
WHERE v.status = 'in_use'
  AND (
    v.current_driver_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.drivers_profiles dp
      WHERE dp.user_id = v.current_driver_id
        AND dp.is_active = true
    )
  );

-- 4) Kontrol: mesaideki sürücüler ve konumları
SELECT
  u.email,
  u.full_name,
  u.role,
  dp.is_active,
  dp.current_lat,
  dp.current_lng,
  v.plate
FROM public.drivers_profiles dp
JOIN public.users u ON u.id = dp.user_id
LEFT JOIN public.vehicles v ON v.current_driver_id = dp.user_id AND v.status = 'in_use'
WHERE dp.is_active = true
ORDER BY u.email;
