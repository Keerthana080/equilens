/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0b1220',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(16, 24, 40, 0.08)',
      },
    },
  },
  plugins: [],
}

