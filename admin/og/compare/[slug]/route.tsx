/* app/og/compare/[slug]/route.tsx */

import { ImageResponse } from 'next/og';
export const runtime = 'edge';

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const [left, right] = decodeURIComponent(params.slug).split('-vs-');

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          backgroundColor: '#111827',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '4rem',
        }}
      >
        <div style={{ fontSize: 36, fontWeight: 'bold', marginBottom: 16 }}>
          Campaign Comparison
        </div>
        <div style={{ fontSize: 72, fontWeight: 'bold' }}>
          {left} vs {right}
        </div>
        <div style={{ fontSize: 28, marginTop: 24 }}>
          Conversion, Signups & Engagement
        </div>
        <div style={{ fontSize: 18, marginTop: 8, color: '#9CA3AF' }}>
          compare.quicksites.ai
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
