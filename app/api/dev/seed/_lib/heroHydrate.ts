import OpenAI from 'openai';
import { normalizeTemplate as normalizeTemplateServer } from '@/admin/utils/normalizeTemplate';
import { generateDataUrlPNG } from './openaiIdeation'; 
import { uploadDataUrlPNG } from './storage';          

const openaiApiKey = process.env.OPENAI_API_KEY;

/** Min defaults that pass your Zod hero schema */
function defaultHeroContent(siteName?: string) {
  return {
    headline: `Welcome to ${siteName || 'Your Site'}`,
    subheadline: 'Start editing, and let the magic happen.',
    cta_text: 'Get Started',
    cta_link: '/contact',
    layout_mode: 'inline',
    image_position: 'center',
    blur_amount: 8,
    parallax_enabled: false,
    mobile_layout_mode: 'inline',
    mobile_crop_behavior: 'cover',
  };
}

/** Fill obvious missing bits (copy only, no network). */
function ensureHeroDefaults(data: any, siteName?: string) {
  const d = typeof data === 'string' ? JSON.parse(data) : (data || {});
  const pages = Array.isArray(d?.pages) ? d.pages : [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.content_blocks) ? p.content_blocks : [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b?.type !== 'hero') continue;
      const c = (b.content ??= {});
      const def = defaultHeroContent(siteName);
      if (!c.headline) c.headline = def.headline;
      if (!c.subheadline) c.subheadline = def.subheadline;
      if (!c.cta_text) c.cta_text = def.cta_text;
      if (!('cta_link' in c)) c.cta_link = def.cta_link;
      if (!c.layout_mode) c.layout_mode = def.layout_mode;
      if (!c.image_position) c.image_position = def.image_position;
      if (typeof c.blur_amount !== 'number') c.blur_amount = def.blur_amount;
      if (typeof c.parallax_enabled !== 'boolean') c.parallax_enabled = def.parallax_enabled;
      if (!c.mobile_layout_mode) c.mobile_layout_mode = def.mobile_layout_mode;
      if (!c.mobile_crop_behavior) c.mobile_crop_behavior = def.mobile_crop_behavior;
    }
  }
  return d;
}

/** AI copy suggestions for hero. Falls back silently on any error. */
async function aiSuggestHeroCopy(args: {
  industry?: string; services?: string[]; businessName?: string; city?: string; state?: string;
}) {
  if (!openaiApiKey) return null;
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const sys =
    'Return strict JSON: {"headline":"...","subheadline":"...","cta_text":"..."} ' +
    'Target is a small business website hero. Keep copy concise, benefit-led, no emojis.';
  const parts = [
    args.businessName ? `Business: ${args.businessName}` : null,
    args.industry ? `Industry: ${args.industry}` : null,
    args.services?.length ? `Services: ${args.services.join(', ')}` : null,
    (args.city || args.state) ? `Locale: ${[args.city, args.state].filter(Boolean).join(', ')}` : null,
  ].filter(Boolean).join('\n') || 'Small business website';

  try {
    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    //   response_format: { type: 'json_object' },
      temperature: 0.5,
      messages: [{ role: 'system', content: sys }, { role: 'user', content: parts }],
    });
    const raw = resp.choices?.[0]?.message?.content || '{}';
    const j = JSON.parse(raw);
    const out: Partial<Record<'headline'|'subheadline'|'cta_text', string>> = {};
    if (typeof j.headline === 'string') out.headline = j.headline;
    if (typeof j.subheadline === 'string') out.subheadline = j.subheadline;
    if (typeof j.cta_text === 'string') out.cta_text = j.cta_text;
    return out;
  } catch {
    return null;
  }
}

/** AI hero image, uploads to Storage, returns public URL (or null). */
async function aiGenerateHeroImage(templateId: string, subject: string, opts?: {
  includePeople?: boolean; style?: 'photo'|'illustration'|'3d'|'minimal';
}) {
  try {
    const style = opts?.style || 'photo';
    const neg = opts?.includePeople
      ? 'no text, no watermark, no logo'
      : 'no people, no faces, no portraits, no text, no watermark, no logo';
    const prompt =
      `website hero banner: ${subject}. ` +
      `wide 16:9 composition with ample copy space, modern, clean. ${style}.`;

    const b64 = await generateDataUrlPNG(
        prompt, 
        '1024x1024',
        neg
    );
    if (!b64) return null;
    const url = await uploadDataUrlPNG(b64, `seed/templates/${templateId}/hero_${Date.now()}.png`);
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Ensure hero blocks are valid and (optionally) hydrate missing copy/image with AI.
 * Returns a normalized data object that passes your Zod hero schema.
 */
export async function hydrateHeroBlocks(args: {
  data: any;
  templateId: string;
  siteName?: string;
  autoCopy?: boolean;
  autoImage?: boolean;
  industry?: string;
  services?: string[];
  businessName?: string;
  city?: string;
  state?: string;
}) {
  // 1) ensure plain defaults so normalization passes
  let d = ensureHeroDefaults(args.data, args.siteName);

  // 2) optionally AI-fill copy for the first hero on the first page missing fields
  if (args.autoCopy) {
    try {
      const pages = Array.isArray(d?.pages) ? d.pages : [];
      const first = pages[0];
      const b = first?.content_blocks?.find((x: any) => x?.type === 'hero');
      if (b) {
        const c = b.content ??= {};
        if (!c.headline || !c.subheadline || !c.cta_text) {
          const ai = await aiSuggestHeroCopy({
            industry: args.industry,
            services: args.services,
            businessName: args.businessName,
            city: args.city,
            state: args.state,
          });
          if (ai?.headline && !c.headline) c.headline = ai.headline;
          if (ai?.subheadline && !c.subheadline) c.subheadline = ai.subheadline;
          if (ai?.cta_text && !c.cta_text) c.cta_text = ai.cta_text;
        }
      }
    } catch {/* ignore */}
  }

  // 3) optionally generate image
  if (args.autoImage) {
    try {
      const pages = Array.isArray(d?.pages) ? d.pages : [];
      const first = pages[0];
      const b = first?.content_blocks?.find((x: any) => x?.type === 'hero');
      if (b) {
        const c = b.content ??= {};
        if (!c.image_url) {
          const subject =
            c.image_subject ||
            `${args.industry || 'business'} website hero banner`;
          const url = await aiGenerateHeroImage(args.templateId, subject, { includePeople: false, style: 'photo' });
          if (url) c.image_url = url;
        }
      }
    } catch {/* ignore */}
  }

  // 4) normalize so props→content etc. are consistent for your editor
  const norm = normalizeTemplateServer({ data: d } as any);
  return norm.data;
}
