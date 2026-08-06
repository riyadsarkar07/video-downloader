import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0b0f1a',
          soft: '#111827',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        accent: {
          DEFAULT: '#22d3ee',
          soft: '#67e8f9',
        },
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(99, 102, 241, 0.55)',
        'glow-accent': '0 0 40px -8px rgba(34, 211, 238, 0.45)',
      },
      animation: {
        'gradient-x': 'gradient-x 8s ease infinite',
        float: 'float 7s ease-in-out infinite',
        'pulse-slow': 'pulse 5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'gradient-x': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-16px)' },
        },
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(120deg, #6366f1 0%, #8b5cf6 30%, #ec4899 65%, #f59e0b 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
