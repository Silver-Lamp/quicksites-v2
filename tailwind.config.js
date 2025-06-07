/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        text: 'var(--color-text)',
        brand: 'var(--color-brand)',
        accent: 'var(--color-accent)',
      },
      spacing: {
        xs: '0.5rem',
        sm: '1rem',
        md: '2rem',
        lg: '3rem',
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.5rem',
        xl: '1rem',
      }
    }
  },
  plugins: []
};
