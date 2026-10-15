/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 900: '#0F1B2D', 800: '#152238', 700: '#1B2D45', 600: '#243B5C', 500: '#2D4A73' },
        primary: { DEFAULT: '#22C55E', hover: '#16A34A', light: '#DCFCE7' },
        accent: { DEFAULT: '#3B82F6', hover: '#2563EB', light: '#DBEAFE' },
        warning: { DEFAULT: '#F59E0B', light: '#FEF3C7' },
        danger: { DEFAULT: '#EF4444', light: '#FEE2E2' },
        surface: { DEFAULT: '#FFFFFF', secondary: '#F8FAFC', tertiary: '#F1F5F9' },
        border: { DEFAULT: '#E2E8F0', dark: '#CBD5E1' },
        text: { primary: '#1E293B', secondary: '#64748B', tertiary: '#94A3B8' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
    },
  },
  plugins: [],
}
