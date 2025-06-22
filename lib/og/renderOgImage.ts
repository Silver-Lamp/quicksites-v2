import { ImageResponse } from '@vercel/og';
import { Theme, Brand } from '@/types/template';

const THEMES: Record<Theme, { background: string; foreground: string }> = {
  dark: {
    background: '#0f172a',
    foreground: '#ffffff',
  },
  light: {
    background: '#f1f5f9',
    foreground: '#0f172a',
  },
};

const BRANDS: Record<Brand, string> = {
  green: '#10b981',
  blue: '#3b82f6',
  red: '#ef4444',
  purple: '#8b5cf6',
  orange: '#f59e0b',
};

export function renderOgImage({
  title,
  content,
  theme = 'dark',
  brand = 'green',
  emoji,
  logoUrl,
}: {
  title: string;
  content: string;
  theme?: Theme;
  brand?: Brand;
  emoji?: string; // optional emoji/icon to prefix title
  logoUrl?: string; // optional logo to display top-right
}) {
  const t = THEMES[theme] ?? THEMES.dark;
  const accent = BRANDS[brand] ?? BRANDS.green;

  return new ImageResponse(
    {
      type: 'div',
      key: 'root',
      props: {
        style: {
          background: t.background,
          color: t.foreground,
          width: '100%',
          height: '100%',
          padding: '60px 80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          fontFamily: "'Inter', sans-serif",
          position: 'relative',
        },
        children: [
          logoUrl && {
            type: 'img',
            props: {
              src: logoUrl,
              style: {
                position: 'absolute',
                top: 40,
                right: 60,
                width: 80,
                height: 80,
                borderRadius: '50%',
                objectFit: 'cover',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 56,
                fontWeight: 800,
                marginBottom: 24,
                lineHeight: 1.2,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              },
              children: [
                emoji && {
                  type: 'span',
                  props: {
                    style: { fontSize: 64 },
                    children: emoji,
                  },
                },
                content,
              ].filter(Boolean),
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 28,
                opacity: 0.85,
                fontWeight: 500,
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                marginTop: 32,
                width: 180,
                height: 8,
                borderRadius: 4,
                backgroundColor: accent,
              },
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
    }
  );
}
