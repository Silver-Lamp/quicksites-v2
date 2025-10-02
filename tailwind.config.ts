// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  // Use class-based dark mode (optionally also support [data-theme="dark"] in your app shell)
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './components/admin/templates/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  safelist: [
    { pattern: /bg-(indigo|cyan|fuchsia|red|green|blue|yellow)-(100|200|300|400|500|600|700)/ },
    { pattern: /text-(indigo|cyan|fuchsia|red|green|blue|yellow)-(500|600|700)/ },
    { pattern: /border-(indigo|cyan|fuchsia|red|green|blue|yellow)-(100|200|300|400|500|600|700)/ },
    { pattern: /rounded-(none|sm|md|lg|xl|2xl|3xl|full)/ },
    { pattern: /font-(sans|serif|mono|custom)/ },
  ],
  theme: {
    extend: {
      spacing: {
        '64': '16rem', // Ensures sidebar width matches `ml-64`
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Roboto Slab', 'serif'],
        mono: ['Fira Code', 'monospace'],
        cursive: ['Pacifico', 'cursive'],
        custom: ['var(--custom-font)', 'sans-serif'],
      },
      colors: {
        // Map to CSS variables set in globals.css
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',

        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // New: card tokens so sections can "float" above background
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

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
          foreground: 'hsl(var(--muted-foreground))', // great for placeholders
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
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeOut: { '0%': { opacity: '1' }, '50%': { opacity: '0.5' }, '100%': { opacity: '0' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        zoomIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        bounceIn: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6%)' } },
        fadeScale: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseSlow: { '0%, 100%': { transform: 'scale(1)', opacity: '0.2' }, '50%': { transform: 'scale(1.05)', opacity: '0.3' } },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 1s ease-out forwards',
        'slide-up': 'slideUp 0.3s ease-out',
        'zoom-in': 'zoomIn 0.25s ease-out',
        bounce: 'bounceIn 0.6s ease-out',
        'fade-scale': 'fadeScale 0.2s ease-out',
        'pulse-slow': 'pulseSlow 10s ease-in-out infinite',
      },
      boxShadow: {
        light: '0 2px 8px rgba(0, 0, 0, 0.04)',
        dark: '0 2px 10px rgba(0, 0, 0, 0.6)',
        popup: '0 0 0 1px rgba(0, 0, 0, 0.04), 0 10px 15px rgba(0, 0, 0, 0.1)',
        'xl-dark': '0 20px 30px rgba(0, 0, 0, 0.8)',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'hsl(var(--foreground))',
            '--tw-prose-headings': 'hsl(var(--foreground))',
            '--tw-prose-p': 'hsl(var(--foreground))',
            '--tw-prose-li': 'hsl(var(--foreground))',
            '--tw-prose-strong': 'hsl(var(--foreground))',
            '--tw-prose-a': 'hsl(var(--foreground))',
            '--tw-prose-code': 'hsl(var(--foreground))',
            '--tw-prose-pre': 'hsl(var(--foreground))',
            '--tw-prose-pre-code': 'hsl(var(--foreground))',
            '--tw-prose-pre-bg': 'hsl(var(--background))',
            '--tw-prose-pre-code-bg': 'hsl(var(--background))',
            '--tw-prose-pre-code-text': 'hsl(var(--foreground))',
          },
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
  ],
};

export default config;
