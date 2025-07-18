// lib/theme/fontMap.ts

export const fontMap = {
    sans: {
      label: 'Inter',
      tailwind: 'font-sans',
      css: "'Inter', sans-serif",
      googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap',
    },
    serif: {
      label: 'Roboto Slab',
      tailwind: 'font-serif',
      css: "'Roboto Slab', serif",
      googleUrl: 'https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;700&display=swap',
    },
    mono: {
      label: 'Fira Code',
      tailwind: 'font-mono',
      css: "'Fira Code', monospace",
      googleUrl: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&display=swap',
    },
    cursive: {
      label: 'Pacifico',
      tailwind: 'font-sans',
      css: "'Pacifico', cursive",
      googleUrl: 'https://fonts.googleapis.com/css2?family=Pacifico&display=swap',
    },
  } as const;
  
  export type FontKey = keyof typeof fontMap;
  