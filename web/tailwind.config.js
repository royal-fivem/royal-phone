/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        phone: {
          frame: '#050506',
          bezel: '#131316',
          screen: '#0a0a0c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        phone: '0 40px 90px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06)',
        icon: '0 6px 14px -6px rgba(0,0,0,0.8)',
      },
      borderRadius: {
        phone: '46px',
      },
    },
  },
  plugins: [],
}
