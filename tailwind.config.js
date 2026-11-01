/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          50: '#f3f8f7', 100: '#e0eeeb', 200: '#c2dcd6', 300: '#96c3ba',
          400: '#5fa296', 500: '#3a8579', 600: '#2a6f64', 700: '#245a52',
          800: '#204a44', 900: '#1c3d38', 950: '#0e2421',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0284c7',
          600: '#0284c7',
          700: '#0369a1',
          900: '#0c4a6e',
        },
        kernel: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          700: '#b45309',
          900: '#78350f',
        },
        epistemic: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#10b981',
          700: '#047857',
        },
        authority: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          700: '#b91c1c',
        }
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
