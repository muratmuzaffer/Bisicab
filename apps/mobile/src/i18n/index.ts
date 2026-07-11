import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { en } from './locales/en';
import { tr, type TranslationKey } from './locales/tr';

const LOCALE_KEY = 'bisicab.locale';

export type Locale = 'tr' | 'en';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { tr, en };

interface LocaleState {
  locale: Locale;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: TranslationKey) => string;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: 'tr',
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(LOCALE_KEY);
      if (raw === 'en' || raw === 'tr') {
        set({ locale: raw, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  setLocale: async (locale) => {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
    set({ locale });
  },

  t: (key) => {
    const locale = get().locale;
    return dictionaries[locale][key] ?? dictionaries.tr[key] ?? key;
  },
}));

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  const t = useLocaleStore((s) => s.t);
  return { t, locale };
}
