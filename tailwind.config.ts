import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        card: 'var(--card)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        brand: {
          400: '#818cf8',
          500: '#6366f1',
        },
      },
      boxShadow: {
        glow: '0 0 24px -8px rgba(99, 102, 241, 0.55)',
        soft: '0 10px 40px -20px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
