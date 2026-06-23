/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        teal: {
          50: '#f0fdfa',
          100: '#e0faf5',
          500: '#00897B',
          600: '#007a69',
          700: '#006b5f',
        },
        urgency: {
          low: '#4CAF50',
          moderate: '#FFC107',
          high: '#F44336',
          emergency: '#9C27B0',
        }
      },
      fontFamily: {
        sans: ['Poppins', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
