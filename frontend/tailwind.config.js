/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tcb: {
          blue:    '#1B4F8A',
          gold:    '#C9A84C',
          red:     '#C0392B',
          light:   '#EBF2FA',
          gray:    '#F5F7FA',
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
