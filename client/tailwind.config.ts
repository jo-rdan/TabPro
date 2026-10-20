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
        // Deep-ink neutrals (a touch of plum), in both themes. Not brown: see the 2026-10-20 retheme.
        gray: {
          50:  '#F7F5F9',
          100: '#EFEBF2',
          200: '#E2DCE8',
          300: '#C8BFD2',
          400: '#9C90A8',
          500: '#6F6379',
          600: '#554A60',
          700: '#41354E',
          800: '#33293F',
          900: '#231A2C',
          950: '#1B1524',
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
