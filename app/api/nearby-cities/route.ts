// app/api/nearby-cities/route.ts
import { NextRequest } from 'next/server';
import { getNearbyCities } from '@/lib/location/getNearbyCities';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');

  console.log('[API] Incoming query:', { lat, lng, radius });

  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: 'Missing lat or lng' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const cities = await getNearbyCities(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 48280
    );
    console.log('[API] Cities returned:', cities);
    return new Response(JSON.stringify({ cities }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[API] Error fetching cities:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch cities' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
