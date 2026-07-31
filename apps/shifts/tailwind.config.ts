import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: '#D8DED9',
        background: '#FFFFFF',
        foreground: '#0B0F0C',
        muted: '#EEF1EE',
        'muted-foreground': '#5C6B61',
        brand: {
          DEFAULT: '#F5C518',
          dark: '#0B0F0C',
          light: '#FFE566',
          deep: '#D4A017',
        },
        surface: '#141A16',
        canvas: '#F7F8F6',
        soft: '#E8EDE9',
        success: '#22C55E',
        danger: '#EF4444',
        shift4: {
          DEFAULT: '#3B82F6',
          light: '#DBEAFE',
          dark: '#1D4ED8',
        },
        shift8: {
          DEFAULT: '#22C55E',
          light: '#DCFCE7',
          dark: '#15803D',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(11, 15, 12, 0.06), 0 4px 16px rgba(11, 15, 12, 0.04)',
        search: '0 4px 24px rgba(245, 197, 24, 0.15)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
