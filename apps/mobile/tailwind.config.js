/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0EA5E9',
          dark: '#0369A1',
          light: '#38BDF8',
        },
        success: '#16A34A',
        danger: '#DC2626',
      },
    },
  },
  plugins: [],
};
