import { ImageResponse } from '@vercel/og';

export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.pathname.split('/').pop() || 'example';

  return new ImageResponse(
    (
      <div
        style={{
          background: '#111',
          color: '#fff',
          padding: '40px',
          fontSize: 32,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
        }}
      >
        🚀 {slug}.com is now live!
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
