import { ImageResponse } from '@vercel/og';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  runtime: 'edge',
};

const fallbackImage = 'https://quicksites.ai/assets/fallback.png';

export default function handler(req: NextApiRequest, _res: NextApiResponse) {
  const { searchParams } = new URL(req.url || 'https://quicksites.ai');
  const slug = searchParams.get('slug') || 'example.com';
  const template = searchParams.get('template') || 'default';

  const formattedSlug = slug
    .replace('.com', '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
  const screenshotUrl = `https://quicksites.ai/public/screenshots/${slug}.png`;

  return new ImageResponse(
    (
      <div
        style={{
          backgroundImage: `url(${screenshotUrl})`,
          backgroundSize: 'cover',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '2rem',
          color: 'white',
          textShadow: '0 2px 6px rgba(0,0,0,0.8)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 'bold', marginTop: '1em' }}>{formattedSlug}</div>
        <div
          style={{
            fontSize: 24,
            background: 'rgba(0,0,0,0.6)',
            padding: '0.5em 1em',
            borderRadius: '6px',
          }}
        >
          {template === 'default' ? 'Powered by QuickSites' : `Template: ${template}`}
        </div>
        <img
          src={fallbackImage}
          alt="QuickSites Logo"
          width={120}
          height={120}
          style={{ borderRadius: '50%', marginBottom: '1rem' }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
