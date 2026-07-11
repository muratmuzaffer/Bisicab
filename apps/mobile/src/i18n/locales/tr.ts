export const tr = {
  appName: 'BisiCab',
  driverMode: 'Sürücü',
  passengerMode: 'Yolcu',
  driverLoginHint: 'Sürücü paneli',
  passengerLoginHint: 'Yolcu ekranı — aynı hesapla eşlenir',
  email: 'E-posta',
  password: 'Şifre',
  signIn: 'Giriş Yap',
  signOut: 'Çıkış',
  loginSuccess: 'Giriş başarılı',
  emailPasswordRequired: 'E-posta ve şifre gerekli.',
  welcomePassenger: "BisiCab'a Hoş Geldiniz!",
  waitingTrip: 'Yolculuğunuz başladığında bilgiler burada görünecek.',
  currentFare: 'GÜNCEL TUTAR',
  distance: 'Mesafe',
  duration: 'Süre',
  speed: 'Hız',
  tripActive: 'Yolculuk devam ediyor',
  pairedAs: 'Eşleşmiş hesap',
  language: 'Dil',
  langTr: 'Türkçe',
  langEn: 'English',
  kmh: 'km/s',
  tipsTitle: 'İzmir tavsiyeleri',
  tipsShort: 'Keşfet',
  routeLabel: 'Alsancak → Konak kordon hattı',
  enjoyRide: 'Deniz esintili, sıfır emisyonlu bir yolculuğa hazır olun.',
  flatRateNote: 'İlk 2,5 km sabit ücret · sonrası km başına ek',
  izulas: 'İZULAŞ BisiCab',
  tipKordonTitle: 'Kordon boyunca sürüş',
  tipKordonBody:
    'Alsancak Limanı\'ndan Konak\'a uzanan sahil şeridi İzmir\'in en güzel manzaralarından biridir. Fotoğraf için en iyi ışık gün batımına yakın saatlerdir.',
  tipClockTitle: 'Konak Saat Kulesi',
  tipClockBody:
    '1901\'den beri kentin simgesi. Yolculuğunuz Konak tarafına yaklaştığında kuleyi sağ tarafınızda görebilirsiniz.',
  tipAlsancakTitle: 'Alsancak Limanı',
  tipAlsancakBody:
    'Birçok yolculuk buradan başlar. Tarihi iskele ve kafelerin bulunduğu Alsancak, İzmir\'in kalbindeki liman semtidir.',
  tipKonakPierTitle: 'Konak Pier & Pasaport',
  tipKonakPierBody:
    'Alışveriş ve deniz manzarası için ideal duraklar. Pasaport İskelesi bölgesinde kısa molalar verilebilir.',
  tipFareTitle: 'Ücret nasıl hesaplanır?',
  tipFareBody:
    '2,5 km\'ye kadar sabit 150 TL. Sonrasında her ek km için 45 TL. Ekrandaki tutar canlı güncellenir.',
  tipSafetyTitle: 'Güvenli yolculuk',
  tipSafetyBody:
    'Lütfen otururken emniyet kemerinizi kullanın. Bisiklet hareket halindeyken ayağa kalkmayın.',
  chipZero: '⚡ Sıfır emisyon',
  chipKordon: '🌊 Kordon',
  chipLive: '📍 Canlı GPS',
} as const;

export type TranslationKey = keyof typeof tr;
