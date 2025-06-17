import { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { lat, lon } = (req.query as { lat: string; lon: string }) || {
    lat: '',
    lon: '',
  };
  if (!lat || !lon) {
    return json({ error: 'Missing lat or lon' });
  }
  const result = await fetch(
    `https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${process.env.OPENCAGE_KEY}`
  );
  const data = await result.json();
  const components = data.results?.[0]?.components || {};

  json({
    city: components.city || components.town || components.village || null,
    state: components.state || null,
  });
}
