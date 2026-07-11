// Dinamik Expo yapılandırması (JS - Expo TS config yükleyici sorunlarını önler).
// Gizli Mapbox "download token" (sk...) yalnızca native derleme için gerekir
// ve ortam değişkeninden okunur; ASLA kaynak koda gömülmez / commit edilmez.
const MAPBOX_DOWNLOAD_TOKEN = process.env.MAPBOX_DOWNLOAD_TOKEN ?? '';

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'BisiCab',
  slug: 'bisicab',
  scheme: 'bisicab',
  version: '0.2.2',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    backgroundColor: '#F5F5F5',
    resizeMode: 'contain',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'tr.gov.izmir.izulas.bisicab',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Yolculuk mesafesini hesaplamak için konumunuz kullanılır.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Yolculuk sırasında mesafe takibi için konum gereklidir.',
      NSCameraUsageDescription:
        'Ödeme fişinin fotoğrafını çekmek için kamera kullanılır.',
      UIBackgroundModes: ['location'],
    },
  },
  android: {
    package: 'tr.gov.izmir.izulas.bisicab',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F5F5F5',
    },
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'CAMERA',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Yolculuk sırasında mesafe takibi için konum gereklidir.',
        locationAlwaysAndWhenInUsePermission:
          'Mesai boyunca (uygulama kapalıyken de) konumunuz admin panelinde takip edilir.',
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Ödeme fişinin fotoğrafını çekmek için kamera kullanılır.',
      },
    ],
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: MAPBOX_DOWNLOAD_TOKEN,
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'b6894335-1757-4524-8b35-2eb52e18126a',
    },
  },
};
