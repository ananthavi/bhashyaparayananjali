import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        devanagari: ['"Noto Serif Devanagari"', '"Noto Sans Devanagari"', 'serif'],
        malayalam: ['Manjari', '"Noto Sans Malayalam"', 'serif'],
        iast: ['"Noto Serif"', 'Georgia', 'serif'],
        ui: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        parchment: {
          50: '#fdfaf3',
          100: '#fbf5ec',
          200: '#f3e8d3',
          300: '#e8d4ad',
          400: '#d4b578',
          500: '#b8944a',
          600: '#8a6a2c',
          700: '#6b3410',
          800: '#4a230b',
          900: '#2d1406',
        },
      },
      boxShadow: {
        sutra: '0 1px 2px rgba(107, 52, 16, 0.08), 0 2px 8px rgba(107, 52, 16, 0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
