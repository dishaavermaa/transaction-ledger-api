/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette: vanilla cream (surfaces), cocoa brown (ink), sky blue (accent).
        cream: {
          50: '#FFFDF7',
          100: '#FBF5E6',
          200: '#F4E9CE',
          300: '#EBD9AE',
        },
        cocoa: {
          500: '#8A6A52',
          600: '#6B4E3A',
          700: '#4E3626',
          800: '#3A281B',
        },
        sky: {
          400: '#6FBEE8',
          500: '#3FA3DC',
          600: '#2B86BC',
          700: '#20688F',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(74, 54, 38, 0.06), 0 8px 24px rgba(74, 54, 38, 0.08)',
      },
    },
  },
  plugins: [],
};
