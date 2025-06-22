export const runtime = 'nodejs';

import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return Response.json({ error: 'Missing lat or lon' }, { status: 400 });
  }

  try {
    const result = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${process.env.OPENCAGE_KEY}`
    );
    const data = await result.json();
    const components = data.results?.[0]?.components || {};

    return Response.json({
      city: components.city || components.town || components.village || null,
      state: components.state || null,
    });
  } catch (err: any) {
    return Response.json({ error: 'Failed to reverse geocode' }, { status: 500 });
  }
}
