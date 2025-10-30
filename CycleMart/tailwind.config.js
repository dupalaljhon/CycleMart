/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // New 3-Color System
        'primary': {
          DEFAULT: '#14B8A6', // Teal - Navbar, links, icons
          light: '#5EEAD4',
          dark: '#0F766E',
        },
        'secondary': {
          DEFAULT: '#1E293B', // Navy - Text, shadows, sidebar
          light: '#475569',
          dark: '#0F172A',
        },
        'accent': {
          DEFAULT: '#84CC16', // Lime Green - Buttons, highlights, notifications
          light: '#BEF264',
          dark: '#65A30D',
        },
        // Text colors (Navy-based)
        'text': {
          primary: '#1E293B',
          secondary: '#475569',
          tertiary: '#64748b',
          inverse: '#ffffff',
        },
        // Background colors
        'bg': {
          primary: '#ffffff',
          secondary: '#f8fafc',
          tertiary: '#f1f5f9',
          card: '#ffffff',
          sidebar: '#1E293B',
        },
        // Border colors
        'border': {
          primary: '#e2e8f0',
          secondary: '#cbd5e1',
        }
      },
    },
  },
  plugins: [],
}
