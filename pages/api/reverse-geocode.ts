export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const result = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${process.env.OPENCAGE_KEY}`);
    const data = await result.json();
    const components = data.results?.[0]?.components || {};
  
    res.status(200).json({
      city: components.city || components.town || components.village || null,
      state: components.state || null,
    });
  }