import { ImageResponse } from '@vercel/og';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  runtime: 'edge',
};

export default function handler(req: NextApiRequest, _res: NextApiResponse) {
  const { searchParams } = new URL(req.url || 'https://quicksites.ai');
  const slug = searchParams.get('slug') || 'example';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#111',
          color: '#fff',
          padding: '40px',
          fontSize: 32,
        }}
      >
        🚀 {slug}.com is now live!
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
