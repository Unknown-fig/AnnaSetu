/** @type {import('tailwindcss').Config} */

const govgreen = {
  DEFAULT: '#15803d', // Forest Green for FIFO Compliant
  900: '#14532d',
  800: '#166534',
  700: '#15803d',
  600: '#16a34a',
  100: '#dcfce7',
  50: '#f0fdf4',
};

const govamber = {
  DEFAULT: '#b45309', // Amber for Ageing Stock
  900: '#78350f',
  800: '#92400e',
  700: '#b45309',
  600: '#d97706',
  100: '#fef3c7',
  50: '#fffbeb',
};

const govred = {
  DEFAULT: '#b91c1c', // Government Alert Red
  900: '#7f1d1d',
  800: '#991b1b',
  700: '#b91c1c',
  600: '#dc2626',
  100: '#fee2e2',
  50: '#fef2f2',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        govnavy: {
          950: '#07162c',
          900: '#0f294a',
          850: '#132f57',
          800: '#1e3a8a', // Official Deep Government Navy Blue
          700: '#1d4ed8',
          600: '#2563eb',
          100: '#dbeafe',
          50: '#eff6ff',
        },
        govsaffron: {
          DEFAULT: '#f97316',
          700: '#c2410c',
          600: '#ea580c',
          500: '#f97316',
          400: '#fb923c',
          200: '#fed7aa',
          100: '#ffedd5',
          50: '#fff7ed',
        },
        govgreen,
        govamber,
        govred,
        fifo: {
          green: govgreen.DEFAULT,
          greenDark: govgreen[800],
          amber: govamber.DEFAULT,
          rose: govred.DEFAULT,
          roseDark: govred[800]
        }
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        hind: ['"Hind"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-red': 'flashRed 0.5s ease-in-out infinite alternate',
      },
      keyframes: {
        flashRed: {
          '0%': { backgroundColor: 'rgba(185, 28, 28, 0.25)', borderColor: 'rgb(185, 28, 28)' },
          '100%': { backgroundColor: 'rgba(185, 28, 28, 0.05)', borderColor: 'rgb(153, 27, 27)' },
        }
      }
    },
  },
  plugins: [],
}
