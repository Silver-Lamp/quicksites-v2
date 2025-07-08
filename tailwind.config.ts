import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  safelist: [
    {
      pattern: /bg-(indigo|cyan|fuchsia|red|green|blue)-(100|200|300|400|500|600|700)/,
    },
    {
      pattern: /border-(indigo|cyan|fuchsia|red|green|blue)-(100|200|300|400|500|600|700)/,
    },
    {
      pattern: /rounded-(none|sm|md|lg|xl|2xl|3xl|full)/,
    },
    {
      pattern: /font-(sans|serif|mono)/,
    },
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: 'hsl(var(--destructive))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        fadeOut: {
          '0%': { opacity: '1' },
          '50%': { opacity: '0.5' },
          '100%': { opacity: '0' },
        },
        'pulse-slow': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.2' },
          '50%': { transform: 'scale(1.05)', opacity: '0.3' },
        },
      },
      animation: {
        'fade-out': 'fadeOut 1s ease-out forwards',
        'pulse-slow': 'pulse-slow 10s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
