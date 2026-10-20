/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Skuzi tangerine (was rust, before that TabPro green). Every `brand-*` class speaks Skuzi.
        brand: {
          50:  '#FEF3EC',
          100: '#FCE3D3',
          200: '#F8C3A5',
          300: '#F29C6F',
          400: '#E8733F',
          500: '#BF4A1A',
          600: '#A63F15',
          700: '#8A3412',
          800: '#6E2A10',
          900: '#52200D',
        },
        // Deep-ink neutrals (a touch of plum). Values live in index.css as CSS variables so the
        // guest pages can swap to their orange skin in light mode.
        gray: {
          50:  'rgb(var(--gray-50) / <alpha-value>)',
          100: 'rgb(var(--gray-100) / <alpha-value>)',
          200: 'rgb(var(--gray-200) / <alpha-value>)',
          300: 'rgb(var(--gray-300) / <alpha-value>)',
          400: 'rgb(var(--gray-400) / <alpha-value>)',
          500: 'rgb(var(--gray-500) / <alpha-value>)',
          600: 'rgb(var(--gray-600) / <alpha-value>)',
          700: 'rgb(var(--gray-700) / <alpha-value>)',
          800: 'rgb(var(--gray-800) / <alpha-value>)',
          900: 'rgb(var(--gray-900) / <alpha-value>)',
          950: 'rgb(var(--gray-950) / <alpha-value>)',
        },
        // Buttons: deep ink in light mode, tangerine in dark mode (index.css).
        action: {
          DEFAULT: 'rgb(var(--action) / <alpha-value>)',
          hover: 'rgb(var(--action-hover) / <alpha-value>)',
          ink: 'rgb(var(--action-ink) / <alpha-value>)',
        },
        // Success / paid = sage.
        green: {
          50:  '#EEF2EB',
          100: '#E4EADF',
          200: '#CBD8C4',
          300: '#A9BE9F',
          400: '#86A27B',
          500: '#5E7A55',
          600: '#4F6847',
          700: '#3F5A38',
          800: '#33482D',
          900: '#263722',
        },
        // Highlights, warnings and waiting = sunny golden yellow.
        amber: {
          50:  '#FFF7E0',
          100: '#FFEDB8',
          200: '#FFE08A',
          300: '#FFD15C',
          400: '#FAC343',
          500: '#F2B33A',
          600: '#CF9020',
          700: '#A06D14',
          800: '#73500E',
          900: '#4D360A',
        },
        white: '#FDFCFE',
      },
      // Skuzi brand: tangerine, deep ink and sun. Use these for new screens; the old
      // `brand` green stays until every screen has moved over.
      skuzi: {
        espresso: '#231A2C',
        bark: '#33293F',
        rust: '#BF4A1A',
        'rust-deep': '#A63F15',
        honey: '#F2B33A',
        milk: '#F4F0F7',
        cream: '#FDFCFE',
        line: '#E2DCE8',
        muted: '#6F6379',
        body: '#554A60',
        sage: '#5E7A55',
      },
      fontFamily: {
        sans: ['Figtree', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
