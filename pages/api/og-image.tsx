import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const feature = searchParams.get('feature') || 'QuickSites';

  return new ImageResponse(
    (
      <div
        style={{
          background: 'black',
          color: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          fontSize: 64,
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        🚀 {feature} | QuickSites
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
