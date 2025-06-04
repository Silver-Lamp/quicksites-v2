import { ImageResponse } from '@vercel/og';

type Theme = 'light' | 'dark';
type Brand = 'green' | 'blue' | 'red';

const THEMES = {
  dark: {
    background: '#0f172a',
    foreground: 'white'
  },
  light: {
    background: '#f1f5f9',
    foreground: '#0f172a'
  }
};

export function renderOgImage({
  title,
  content,
  theme = 'dark',
  brand = 'green'
}: {
  title: string;
  content: string;
  theme?: Theme;
  brand?: Brand;
}) {
  const t = THEMES[theme] || THEMES.dark;

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          background: t.background,
          color: t.foreground,
          width: '100%',
          height: '100%',
          padding: '60px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif'
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: 52,
                fontWeight: 'bold',
                marginBottom: '20px'
              },
              children: content
            }
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: 24,
                opacity: 0.7
              },
              children: title
            }
          }
        ]
      }
    },
    {
      width: 1200,
      height: 630
    }
  );
}
