import { useEffect, useMemo, useRef, type ElementRef } from 'react';
import { View, Text } from 'react-native';
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  CircleLayer,
} from '@rnmapbox/maps';
import type { LatLng } from '@bisicab/shared';
import { config } from '@/lib/config';
import { initMapbox } from '@/lib/mapbox';

initMapbox();

interface Props {
  path: LatLng[];
  current: LatLng | null;
}

type LineFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'LineString'; coordinates: number[][] };
};

type PointFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'Point'; coordinates: number[] };
};

/** Sürüş sırasında kat edilen rotayı canlı çizen Mapbox haritası. */
export function TripMap({ path, current }: Props) {
  const cameraRef = useRef<ElementRef<typeof Camera>>(null);

  const routeFeature = useMemo<LineFeature>(
    () => ({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: path.map((p) => [p.lng, p.lat]),
      },
    }),
    [path]
  );

  const currentFeature = useMemo<PointFeature | null>(() => {
    if (!current) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [current.lng, current.lat] },
    };
  }, [current]);

  useEffect(() => {
    if (current) {
      cameraRef.current?.setCamera({
        centerCoordinate: [current.lng, current.lat],
        zoomLevel: 16,
        animationDuration: 800,
      });
    }
  }, [current]);

  if (!config.mapboxToken) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
        <Text className="text-brand-light">Harita için Mapbox token'ı gerekli</Text>
      </View>
    );
  }

  return (
    <MapView
      style={{ flex: 1 }}
      styleURL={Mapbox.StyleURL.Street}
      logoEnabled={false}
      attributionEnabled={false}
      scaleBarEnabled={false}
    >
      <Camera
        ref={cameraRef}
        followUserLocation={false}
        defaultSettings={
          current
            ? { centerCoordinate: [current.lng, current.lat], zoomLevel: 16 }
            : undefined
        }
      />

      {path.length > 1 ? (
        <ShapeSource id="route" shape={routeFeature}>
          <LineLayer
            id="route-line"
            style={{
              lineColor: '#F5C518',
              lineWidth: 5,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      ) : null}

      {currentFeature ? (
        <ShapeSource id="current" shape={currentFeature}>
          <CircleLayer
            id="current-dot"
            style={{
              circleRadius: 8,
              circleColor: '#22C55E',
              circleStrokeWidth: 3,
              circleStrokeColor: '#ffffff',
            }}
          />
        </ShapeSource>
      ) : null}
    </MapView>
  );
}
