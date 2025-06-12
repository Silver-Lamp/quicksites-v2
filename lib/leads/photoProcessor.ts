import Tesseract from 'tesseract.js';
import exifr from 'exifr';

export async function createLeadFromPhoto(file: File) {
  const { data } = await Tesseract.recognize(file, 'eng');
  const ocr = { data };
  const text = ocr.data.text;
  const confidence = ocr.data.confidence || 0.7;

  const phoneMatch = text.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  const phone = phoneMatch?.[0] || null;

  const keywords = ['window', 'roof', 'lawn', 'gutter', 'tree'];
  const industry = keywords.find(k => text.toLowerCase().includes(k)) || null;

  const gps = await exifr.gps(file);
  const lat = gps?.latitude ?? null;
  const lon = gps?.longitude ?? null;

  let city = null, state = null;
  if (lat && lon) {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
    ({ city, state } = await res.json());
  }

  // Optional fallback: look for city/state keywords in text if lat/lon not found
  if ((!city || !state) && text.match(/\b(?:[A-Z][a-z]+),?\s?[A-Z]{2}\b/)) {
    const fallback = text.match(/\b([A-Z][a-z]+),\s?([A-Z]{2})\b/);
    city = city || fallback?.[1] || null;
    state = state || fallback?.[2] || null;
  }

  return {
    leadData: {
      phone,
      industry,
      notes: text,
      lat,
      lon,
      city,
      state,
      source: 'photo',
      created_at: new Date().toISOString(),
    },
    confidence
  };
}
