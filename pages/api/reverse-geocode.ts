import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { lat, lon } = req.query as { lat: string; lon: string } || { lat: '', lon: '' };
    if (!lat || !lon) {
        return res.status(400).json({ error: 'Missing lat or lon' });
    }
    const result = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${process.env.OPENCAGE_KEY}`);
    const data = await result.json();
    const components = data.results?.[0]?.components || {};
  
    res.status(200).json({
      city: components.city || components.town || components.village || null,
      state: components.state || null,
    });
  }