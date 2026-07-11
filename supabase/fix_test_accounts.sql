-- =============================================================================
-- BisiCab — E-posta onayı + rol düzeltme (Dashboard'dan kullanıcı ekledikten sonra)
-- Supabase SQL Editor'de TEK TEK veya blok halinde çalıştırın.
-- =============================================================================

-- 1) Tüm test hesaplarının e-postasını onayla
-- Not: confirmed_at generated sütundur; yalnızca email_confirmed_at güncellenir.
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email IN (
  'murat.muzaffer@izulas.com',
  'surucu01@izulas.com',
  'surucu02@izulas.com',
  'surucu03@izulas.com',
  'surucu04@izulas.com',
  'surucu05@izulas.com',
  'surucu06@izulas.com',
  'surucu07@izulas.com',
  'surucu08@izulas.com',
  'surucu09@izulas.com',
  'surucu10@izulas.com'
);

-- 2) Sürücü rolleri
UPDATE public.users
SET role = 'driver'
WHERE email LIKE 'surucu%@izulas.com';

-- 3) Tek admin: Murat Muzaffer
UPDATE public.users
SET role = 'admin', full_name = 'Murat Muzaffer'
WHERE email = 'murat.muzaffer@izulas.com';

-- 4) Diğer tüm admin hesaplarını sürücü yap (mobil test karışıklığını önler)
UPDATE public.users
SET role = 'driver'
WHERE role = 'admin'
  AND email <> 'murat.muzaffer@izulas.com';

-- 5) Kontrol
SELECT email, role, full_name FROM public.users
WHERE email LIKE '%@izulas.com'
ORDER BY role DESC, email;
