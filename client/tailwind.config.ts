/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf0d6',
          300: '#86dcb8',
          400: '#4cc497',
          500: '#1D9E75',
          600: '#158a63',
          700: '#0f7050',
          800: '#0b5c40',
          900: '#064e35',
        },
      },
      // Skuzi brand: coffee & imigongo. Use these for new screens; the old
      // `brand` green stays until every screen has moved over.
      skuzi: {
        espresso: '#2B201B',
        bark: '#3A2D26',
        rust: '#A64B31',
        'rust-deep': '#9A4129',
        honey: '#D9A441',
        milk: '#F4EDE3',
        cream: '#FFFCF7',
        line: '#E3D6C6',
        muted: '#7A6A5F',
        body: '#5C4D44',
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
