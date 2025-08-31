import { openai } from './clients';
import { INDUSTRY_HINTS } from './industries';

/**
 * Brand + product ideation
 * - Structured output via response_format: 'json_object'
 * - Industry hint and product-type nudges included
 * - Cleans prices and product types
 */
export async function ideateBrandAndProducts(params: {
  aiPrompt?: string;
  count: number;
  productType: 'meal'|'physical'|'digital'|'service'|'mixed';
  seed?: string;
  industry?: string;
}) {
  const { aiPrompt, count, productType, seed, industry } = params;

  const sys = `You are a concise brand + product ideation engine for a local merchant marketplace.
Return JSON ONLY with keys { "brand": {...}, "products": [...] }.
Keep copy tight, marketable, and price outputs in USD dollars (not cents).`;

  const industryHint = industry ? (INDUSTRY_HINTS[industry] ?? '') : '';
  const typeNudge =
    productType === 'meal'
      ? 'Focus on restaurant-like menu items, sides, desserts, and bundles.'
      : productType === 'mixed'
      ? 'Return a diverse mix of physical/digital/service offers appropriate to the industry.'
      : `Focus primarily on ${productType} offers appropriate to the industry.`;

  const sysGuard = [
    industry ? `Industry: ${industry}.` : '',
    industryHint,
    typeNudge,
    'Prefer conversion-oriented copy tuned for local search (SEO).',
  ]
    .filter(Boolean)
    .join(' ');

  const user = {
    prompt: aiPrompt ?? 'Neighborhood artisan brand; friendly, trustworthy, quality-first.',
    count,
    productType,
    seed,
    schema: {
      brand: {
        name: 'string',
        tagline: 'string',
        about: 'string',
        city: 'string',
        state: 'string',
      },
      products: [
        {
          title: 'string',
          blurb: 'string',
          type: 'meal | physical | digital | service',
          price_usd: 'number (e.g., 14.99)',
          image_prompt: 'short visual description for a product photo',
        },
      ],
    },
  };

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      { role: 'system', content: sys },
      { role: 'system', content: sysGuard },
      { role: 'user', content: JSON.stringify(user) },
    ],
    // response_format: { type: 'json_object' },
    seed: seed ? Number(seed) : undefined,
  });

  // Robust parse with fallback
  let parsed: any = {};
  const raw = completion.choices?.[0]?.message?.content || '{}';
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  const products = Array.isArray(parsed.products) ? parsed.products.slice(0, count) : [];
  const brand = parsed.brand || {};

  // Clean up product types & prices
  for (const p of products) {
    // type
    if (!p.type || p.type === 'mixed') {
      p.type = productType === 'mixed' ? 'physical' : productType;
    }
    if (!['meal', 'physical', 'digital', 'service'].includes(p.type)) {
      p.type = 'physical';
    }
    // price
    const n = Number(p.price_usd);
    p.price_usd = Number.isFinite(n) && n > 0 ? n : 19;
  }

  return { brand, products };
}

/**
 * Generate a PNG as a base64 data URL using the Images API.
 * The Images API does NOT support a separate `negative` field,
 * so we fold the negative prompt into the main prompt text.
 */
export async function generateDataUrlPNG(
  prompt: string,
  size: '256x256'|'512x512'|'1024x1024' = '1024x1024',
  negative?: string,
): Promise<string | null> {
  const negativePrompt = (negative || '').trim();
  const finalPrompt = negativePrompt ? `${prompt}\n\nExclude: ${negativePrompt}.` : prompt;

  const res = await openai.images.generate({
    model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
    prompt: finalPrompt,
    size,
    n: 1,
    // response_format: 'b64_json',
  });

  const b64 = res.data?.[0]?.b64_json || null;
  return b64 ? `data:image/png;base64,${b64}` : null;
}
