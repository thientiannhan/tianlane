/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Google Sans Flex',
          'Google Sans',
          'Manrope',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['IBM Plex Mono', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          primary: '#121317',
          secondary: '#45474D',
          muted: '#6E717A',
        },
        surface: {
          base: '#FFFFFF',
          subtle: '#F7F8FA',
          pill: '#F1F3F7',
          border: '#E6E8EE',
          strong: '#B7BFD9',
        },
        brand: {
          50: '#EEF3FB',
          100: '#DAE6F8',
          500: '#165DC4',
          600: '#0A4595',
          700: '#083778',
          800: '#06295A',
        },
      },
      boxShadow: {
        'clean-xs': '0 1px 2px rgba(18, 19, 23, 0.04)',
        'clean-sm': '0 2px 8px -2px rgba(18, 19, 23, 0.06), 0 1px 2px rgba(18, 19, 23, 0.04)',
        'clean-md': '0 8px 24px -4px rgba(18, 19, 23, 0.08), 0 2px 6px -1px rgba(18, 19, 23, 0.04)',
        'clean-lg': '0 20px 48px -12px rgba(18, 19, 23, 0.12)',
      },
    },
  },
  plugins: [],
};
