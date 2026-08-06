import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: '#D4DDD6',
        background: '#FFFFFF',
        foreground: '#0A0F0C',
        muted: '#EEF2EF',
        'muted-foreground': '#5A6B60',
        brand: {
          DEFAULT: '#F5C518',
          dark: '#0A0F0C',
          light: '#FFE566',
          deep: '#D4A017',
        },
        surface: {
          DEFAULT: '#111916',
          raised: '#1A221D',
        },
        canvas: '#F4F6F4',
        soft: '#E4EBE6',
        success: '#16A34A',
        danger: '#DC2626',
        shift4: {
          DEFAULT: '#2563EB',
          light: '#EFF6FF',
          muted: '#DBEAFE',
          dark: '#1E40AF',
        },
        shift8: {
          DEFAULT: '#059669',
          light: '#ECFDF5',
          muted: '#D1FAE5',
          dark: '#047857',
        },
        shiftSpecial: {
          DEFAULT: '#9333EA',
          light: '#FAF5FF',
          muted: '#EDE9FE',
          dark: '#7E22CE',
        },
        shiftS: {
          DEFAULT: '#D97706',
          light: '#FFFBEB',
          muted: '#FDE68A',
          dark: '#B45309',
        },
        shiftD: {
          DEFAULT: '#7C3AED',
          light: '#F5F3FF',
          muted: '#DDD6FE',
          dark: '#5B21B6',
        },
        shiftB: {
          DEFAULT: '#EA580C',
          light: '#FFF7ED',
          muted: '#FFEDD5',
          dark: '#C2410C',
        },
        shiftO: {
          DEFAULT: '#0891B2',
          light: '#ECFEFF',
          muted: '#CFFAFE',
          dark: '#0E7490',
        },
        shiftBayram: {
          DEFAULT: '#EC4899',
          light: '#FDF2F8',
          muted: '#FCE7F3',
          dark: '#BE185D',
        },
        shiftSStar: {
          DEFAULT: '#DB2777',
          light: '#FDF2F8',
          muted: '#FBCFE8',
          dark: '#BE185D',
        },
        shiftBStar: {
          DEFAULT: '#E11D48',
          light: '#FFF1F2',
          muted: '#FECDD3',
          dark: '#BE123C',
        },
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10, 15, 12, 0.04), 0 8px 24px rgba(10, 15, 12, 0.06)',
        elevated: '0 4px 6px rgba(10, 15, 12, 0.04), 0 16px 40px rgba(10, 15, 12, 0.08)',
        glow: '0 0 0 1px rgba(245, 197, 24, 0.3), 0 4px 20px rgba(245, 197, 24, 0.25)',
        inset: 'inset 0 1px 2px rgba(10, 15, 12, 0.06)',
      },
      backgroundImage: {
        mesh: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(245, 197, 24, 0.12), transparent),
          radial-gradient(ellipse 60% 40% at 100% 0%, rgba(37, 99, 235, 0.06), transparent),
          linear-gradient(180deg, #F4F6F4 0%, #EEF2EF 100%)
        `,
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
