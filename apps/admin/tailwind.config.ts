import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
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
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
