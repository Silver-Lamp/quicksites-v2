export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip =
    forwarded?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  return new Response(JSON.stringify({ ip }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
