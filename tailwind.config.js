/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#1e1e1e',
          text: '#ffffff',
          prompt: '#00ff00',
        }
      },
      fontFamily: {
        mono: ['Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
} 