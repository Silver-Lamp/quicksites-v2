// ✅ FILE: app/api/og-image/route.tsx

import { ImageResponse } from '@vercel/og';

export const runtime = 'edge'; // ✅ only 'edge' is valid here

export async function GET(req: Request) {
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
