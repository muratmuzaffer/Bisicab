-- =============================================================================
-- Takılı kalan mesai kayıtlarını temizle
-- Supabase SQL Editor'de çalıştırın (fix_live_tracking.sql sonrası).
-- =============================================================================

-- 1) Planlanan bitiş saati geçmiş açık mesaileri kapat
UPDATE public.shifts
SET
  ended_at = COALESCE(planned_end_at, now()),
  end_reason = 'shift_end'
WHERE ended_at IS NULL
  AND planned_end_at IS NOT NULL
  AND planned_end_at < now();

-- 2) 48 saatten eski açık mesaileri kapat (unutulmuş test kayıtları)
UPDATE public.shifts
SET
  ended_at = now(),
  end_reason = 'shift_end'
WHERE ended_at IS NULL
  AND started_at < now() - interval '48 hours';

-- 3) Admin hesaplarının açık mesailerini kapat + is_active sıfırla
UPDATE public.shifts s
SET
  ended_at = now(),
  end_reason = 'shift_end'
FROM public.users u
WHERE s.driver_id = u.id
  AND u.role = 'admin'
  AND s.ended_at IS NULL;

UPDATE public.drivers_profiles dp
SET is_active = false, updated_at = now()
FROM public.users u
WHERE dp.user_id = u.id
  AND u.role = 'admin';

-- 4) Açık mesaisi olmayan sürücülerde is_active kapat
UPDATE public.drivers_profiles dp
SET is_active = false, updated_at = now()
WHERE dp.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.shifts s
    WHERE s.driver_id = dp.user_id
      AND s.ended_at IS NULL
  );

-- 5) Kontrol: gerçekten mesaide olan sürücüler
SELECT
  u.email,
  u.full_name,
  u.role,
  s.started_at,
  s.planned_end_at,
  v.plate AS aktif_arac
FROM public.shifts s
JOIN public.users u ON u.id = s.driver_id
LEFT JOIN public.vehicles v ON v.current_driver_id = s.driver_id AND v.status = 'in_use'
WHERE s.ended_at IS NULL
ORDER BY s.started_at DESC;
