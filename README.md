# BisiCab

İzmir İZULAŞ **Alsancak Limanı – Konak Saat Kulesi** hattında çalışan elektrikli, fayton tipi bisikletler için yolcu taşıma platformu.

Üç yüzey tek bir monorepo altında toplanmıştır:

| Uygulama | Konum | Teknoloji |
| --- | --- | --- |
| Sürücü + Yolcu Tableti | `apps/mobile` | Expo (React Native) + TypeScript + NativeWind + Zustand |
| Admin Yönetim Paneli | `apps/admin` | Next.js 14 (App Router) + Tailwind + Mapbox |
| Paylaşılan iş mantığı | `packages/shared` | Ücret motoru, Haversine, Kalman filtresi, tipler |
| Veritabanı | `supabase/` | PostgreSQL + RLS + Realtime + Storage |

> **Not:** Sürücü uygulaması ve yolcu tableti **tek Expo uygulamasıdır**; rol/moda göre farklı ekranlar açılır (`/(driver)/...` ve `/(passenger)/tablet`).

---

## Ücret Politikası

| Kural | Değer |
| --- | --- |
| Başlangıç / minimum (≤ 2.5 km) | **150 TL** (açılış dahildir) |
| 2.5 km üzeri her km | **+45 TL** |

```
Mesafe ≤ 2.5 km  →  Toplam = 150 TL
Mesafe > 2.5 km  →  Toplam = 150 + (Mesafe - 2.5) × 45
```

Tek kaynak: `packages/shared/src/pricing.ts` (`calculateFare`).

---

## Hassas KM Hesaplama

`packages/shared` içindeki platformdan bağımsız çekirdek:

1. **Örnekleme** – Sürücü cihazından her **3 sn**'de bir konum (`useLocationTracker`).
2. **Kalman filtresi** (`kalman.ts`) – GPS jitter'ını, doğruluk (accuracy) tabanlı ölçüm gürültüsüyle yumuşatır.
3. **Haversine** (`geo.ts`) – Ardışık filtrelenmiş noktalar arası mesafe.
4. **Hız denetimi** (`tracking.ts`) – **30 km/s** üzeri (mantıksız) segmentler hatalı kabul edilip elenir.

Mobil hook: `apps/mobile/src/hooks/useLocationTracker.ts`.

---

## Kurulum

### 0. Gereksinimler
- Node.js ≥ 20, npm ≥ 9
- [Supabase CLI](https://supabase.com/docs/guides/cli) (yerel geliştirme için)
- Expo Go / EAS (mobil), Mapbox hesabı (token)

### 1. Bağımlılıklar (monorepo kökünde)
```bash
npm install
npm run build:shared   # paylaşılan paketi derle
```

### 2. Supabase
```bash
supabase start                       # yerel stack
supabase db reset                    # migrations/0001_init.sql uygulanır
# veya uzak projede:
supabase db push
```
Şema `supabase/migrations/0001_init.sql` içindedir: tablolar, RLS, trigger'lar, `receipts` storage bucket'ı ve realtime yayını.

### 3. Ortam değişkenleri
```bash
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.example  apps/admin/.env.local
```
Supabase URL/anon key ve Mapbox token'larını doldurun.

### 4. Admin panelini çalıştır
```bash
npm run admin    # http://localhost:3000
```

### 5. Mobil: dev build (Mapbox + kamera için gerekli)
`@rnmapbox/maps`, `expo-camera` ve `expo-location` native modüller içerdiğinden mobil,
**Expo Go ile değil, bir development build** ile çalışır.

Mapbox'ın **gizli download token'ını** (sk...) ortam değişkeni olarak verin (commit etmeyin):

```bash
# Windows PowerShell
$env:MAPBOX_DOWNLOAD_TOKEN="sk...."

# macOS/Linux
export MAPBOX_DOWNLOAD_TOKEN="sk...."
```

Yerel derleme (cihaz/emülatör bağlıyken):
```bash
cd apps/mobile
npx expo run:android    # veya: npx expo run:ios
```

Ya da bulutta EAS ile dev client:
```bash
cd apps/mobile
eas build --profile development --platform android
npm run start           # expo start --dev-client
```

> Public Mapbox token'ı (`pk...`) `EXPO_PUBLIC_MAPBOX_TOKEN`, gizli download token'ı
> (`sk...`) `MAPBOX_DOWNLOAD_TOKEN` olarak ayrı tutulur.

---

## Roller ve Akış

- **Sürücü (Öğrenci):** Giriş → Ana ekran (günlük özet + "YOLCULUĞU BAŞLAT") → canlı sürüş (Mapbox harita + rota çizimi, KM/süre/tutar/hız) → "YOLCULUĞU BİTİR" → POS çekimi + fiş fotoğrafı (zorunlu) → "Yolculuğu Tamamla".
- **Yolcu Tableti:** `/(passenger)/tablet` — sürücüye eşlenir, Realtime broadcast ile canlı KM/süre/tutar gösterir.
- **Admin:** `/login` üzerinden Supabase e-posta/şifre girişi (yalnızca `role = 'admin'` olan hesaplar). Dashboard (aktif bisiklet, günlük ciro/km), Canlı Takip (Mapbox harita), Sürüş Denetimi (fiş fotoğraflı tablo + Excel/PDF dışa aktarma). Rotalar `middleware.ts` ile korunur; admin olmayan/oturumsuz erişim `/login`'e yönlenir.

### Bir kullanıcıyı admin yapma
1. Supabase → **Authentication → Users → Add user** ile e-posta/şifre oluşturun (trigger otomatik `driver` rolüyle profil açar).
2. SQL Editor'de rolü admin yapın:
```sql
update public.users set role = 'admin' where email = 'admin@izulas.com';
```
3. `/login`'den bu hesapla girin.

---

## Klasör Yapısı
```
bisicab/
├─ package.json            # npm workspaces
├─ tsconfig.base.json
├─ supabase/
│  ├─ config.toml
│  └─ migrations/0001_init.sql
├─ packages/shared/        # pricing, geo (Haversine), kalman, tracking, types
└─ apps/
   ├─ mobile/              # Expo: (auth) / (driver) / (passenger)
   └─ admin/               # Next.js: /, /live, /trips
```

## Testler
```bash
npm run build:shared && node --test packages/shared/dist
```
Ücret motoru için birim testleri: `packages/shared/src/__tests__/pricing.test.ts`.
