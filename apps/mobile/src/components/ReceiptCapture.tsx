import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

interface Props {
  onCaptured: (uri: string) => void;
  onCancel: () => void;
}

/** POS fişini kamerayla çekip sıkıştırılmış bir görsel URI'si döndürür. */
export function ReceiptCapture({ onCaptured, onCancel }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-black px-8">
        <Text className="mb-6 text-center text-white">
          Fiş fotoğrafı çekmek için kamera izni gereklidir.
        </Text>
        <Pressable
          onPress={requestPermission}
          className="rounded-xl bg-brand px-6 py-3"
        >
          <Text className="font-bold text-white">İzin Ver</Text>
        </Pressable>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (!photo) return;
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );
      onCaptured(manipulated.uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between px-8 pb-12">
        <Pressable onPress={onCancel}>
          <Text className="text-lg text-white">İptal</Text>
        </Pressable>
        <Pressable
          onPress={takePicture}
          disabled={busy}
          className="h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/30"
        >
          {busy ? <ActivityIndicator color="#fff" /> : null}
        </Pressable>
        <View className="w-12" />
      </View>
    </View>
  );
}
