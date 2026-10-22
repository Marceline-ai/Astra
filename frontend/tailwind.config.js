/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F9F7F2',
        ink: '#1F1F1F',
        muted: '#6B6B6B',
        line: '#E5E1DA',
        rose: '#D4A3A3',
        rosedark: '#B98282',
        success: '#2E7D32',
        warning: '#B26A00',
        info: '#356147',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      screens: {
        mobile: '360px',
        desktop: '1440px',
      },
    },
  },
  plugins: [],
};
