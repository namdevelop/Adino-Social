/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        anime: ['"Zen Maru Gothic"', '"M PLUS Rounded 1c"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
