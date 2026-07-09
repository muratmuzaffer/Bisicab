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
| Açılış ücreti | **35 TL** (her yolculukta) |
| Sabit ücret (≤ 2.5 km) | **150 TL** (açılış hariç) |
| 2.5 km üzeri her km | **+45 TL** |

```
Mesafe ≤ 2.5 km  →  Toplam = 35 + 150                       = 185 TL
Mesafe > 2.5 km  →  Toplam = 35 + 150 + (Mesafe - 2.5) × 45
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

### 4. Çalıştırma
```bash
npm run mobile   # Expo (sürücü + yolcu tableti)
npm run admin    # Next.js admin paneli -> http://localhost:3000
```

---

## Roller ve Akış

- **Sürücü (Öğrenci):** Giriş → Ana ekran (günlük özet + "YOLCULUĞU BAŞLAT") → canlı sürüş (KM/süre/tutar) → "YOLCULUĞU BİTİR" → POS çekimi + fiş fotoğrafı (zorunlu) → "Yolculuğu Tamamla".
- **Yolcu Tableti:** `/(passenger)/tablet` — sürücüye eşlenir, Realtime broadcast ile canlı KM/süre/tutar gösterir.
- **Admin:** Dashboard (aktif bisiklet, günlük ciro/km), Canlı Takip (Mapbox harita), Sürüş Denetimi (fiş fotoğraflı tablo + Excel/PDF dışa aktarma).

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
