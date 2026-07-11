/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
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
    },
  },
  plugins: [],
};
