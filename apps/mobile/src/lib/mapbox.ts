import Mapbox from '@rnmapbox/maps';
import { config } from './config';

let initialized = false;

/** Mapbox erişim token'ını bir kez ayarlar. */
export function initMapbox(): void {
  if (initialized) return;
  if (config.mapboxToken) {
    Mapbox.setAccessToken(config.mapboxToken);
  } else if (__DEV__) {
    console.warn('[BisiCab] EXPO_PUBLIC_MAPBOX_TOKEN tanımlı değil; harita yüklenmez.');
  }
  initialized = true;
}
