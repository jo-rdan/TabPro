/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Skuzi rust (was TabPro green). Every `brand-*` class now speaks Skuzi.
        brand: {
          50:  '#FBF1EC',
          100: '#F5E1D7',
          200: '#EBC4B3',
          300: '#DCA088',
          400: '#C67B5E',
          500: '#A64B31',
          600: '#933F28',
          700: '#7D3421',
          800: '#652A1B',
          900: '#4A1F14',
        },
        // Warm coffee neutrals instead of cool greys, in both themes.
        gray: {
          50:  '#F8F3EC',
          100: '#F0E8DD',
          200: '#E3D6C6',
          300: '#CDBDAB',
          400: '#A39282',
          500: '#7A6A5F',
          600: '#5C4D44',
          700: '#463A32',
          800: '#3A2D26',
          900: '#2B201B',
          950: '#1C1511',
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
        white: '#FFFCF7',
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
