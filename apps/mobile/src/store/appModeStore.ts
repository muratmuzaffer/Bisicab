import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const MODE_KEY = 'bisicab.appMode';

export type AppMode = 'driver' | 'passenger';

interface AppModeState {
  mode: AppMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setMode: (mode: AppMode) => Promise<void>;
}

export const useAppModeStore = create<AppModeState>((set) => ({
  mode: 'driver',
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(MODE_KEY);
      if (raw === 'passenger' || raw === 'driver') {
        set({ mode: raw, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  setMode: async (mode) => {
    await AsyncStorage.setItem(MODE_KEY, mode);
    set({ mode });
  },
}));
