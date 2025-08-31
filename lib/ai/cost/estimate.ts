import type { AssumptionProfile } from './assumptions';
import { ASSUMPTIONS } from './assumptions';
import { getPricing } from './pricing';

export type TemplateLike = {
  id: string;
  pages?: { id: string; title?: string; blocks: { type: string; props?: any }[] }[];
};

export type EstimateInput = {
  entityType: 'template'|'merchant'|'product'|'site';
  entityId: string;

  // Text gen (chat) model
  provider: string;
  model_code: string;
  modality?: 'chat';
  profileCode?: AssumptionProfile['code'];

  // Domain bits
  template?: TemplateLike;
  servicesCountPerPage?: number;
  variantCount?: number;

  // IMAGE GEN knobs (hero images)
  imageProvider?: string;          // e.g. 'openai'
  imageModel?: string;             // e.g. 'gpt-image-1:medium'
  heroImageWidth?: number;         // px (default 1536)
  heroImageHeight?: number;        // px (default 1024)
  heroImagesPerHeroBlock?: number; // per hero block per variant (default 1)
};

export type EstimateResult = {
  input_tokens: number;
  output_tokens: number;
  images: number;
  minutes_audio: number;
  estimated_cost_usd: number;
  breakdown: Record<string, number>;
};

function requireNumber(v: number | null | undefined, msg: string) {
  if (v === null || v === undefined) throw new Error(msg);
  return v;
}

export async function estimateTemplateCost(input: EstimateInput): Promise<EstimateResult> {
  /* -------- TEXT GEN -------- */
  const profile = ASSUMPTIONS[input.profileCode ?? 'RICH'];
  const chatPricing = await getPricing(input.provider, input.model_code, 'chat');

  let totalIn = 0, totalOut = 0;
  const breakdown: Record<string, number> = {};

  const pages = input.template?.pages ?? [];
  const regen = profile.regenerationFactor ?? 1.0;
  const servicesPer = input.servicesCountPerPage ?? 4;
  const variants = input.variantCount ?? 1;

  if (profile.perTemplate) {
    totalIn += profile.perTemplate.prompt_in * regen;
    totalOut += profile.perTemplate.gen_out * regen;
  }

  let heroBlockCount = 0;

  for (const page of pages) {
    if (profile.perPage) {
      totalIn += profile.perPage.prompt_in * regen;
      totalOut += profile.perPage.gen_out * regen;
    }
    for (const b of page.blocks) {
      const a = profile.blocks[b.type];
      if (!a) continue;
      let inTok = a.prompt_in;
      let outTok = a.gen_out;

      if (b.type === 'services') {
        const n = Array.isArray(b?.props?.items) ? b.props.items.length : servicesPer;
        inTok *= n; outTok *= n;
      }
      if (b.type === 'hero' || b.type === 'testimonials') {
        inTok *= variants; outTok *= variants;
      }
      if (b.type === 'hero') {
        heroBlockCount += 1;
      }

      totalIn += inTok * regen;
      totalOut += outTok * regen;
    }
  }

  const inUSD = requireNumber(chatPricing.input_per_1k_usd, `Missing input_per_1k_usd for ${chatPricing.provider}:${chatPricing.model_code}`);
  const outUSD = requireNumber(chatPricing.output_per_1k_usd, `Missing output_per_1k_usd for ${chatPricing.provider}:${chatPricing.model_code}`);
  const textUSD = (totalIn / 1000) * inUSD + (totalOut / 1000) * outUSD;
  breakdown['text_generation'] = +textUSD.toFixed(6);

  /* -------- IMAGE GEN: hero images -------- */
  const imgProvider = input.imageProvider ?? input.provider;
  const imgModel = input.imageModel ?? 'gpt-image-1:medium';
  const heroW = Math.max(1, input.heroImageWidth ?? 1536);
  const heroH = Math.max(1, input.heroImageHeight ?? 1024);
  const heroPerBlock = Math.max(0, input.heroImagesPerHeroBlock ?? 1);

  const imagesNeeded = heroBlockCount * variants * heroPerBlock;

  let imageUSD = 0;
  if (imagesNeeded > 0) {
    const imgPricing = await getPricing(imgProvider, imgModel, 'image');
    const base = imgPricing.image_base_usd ?? 0;
    const perMP = imgPricing.image_per_mp_usd ?? 0;

    const mp = (heroW * heroH) / 1_000_000;
    const perImage = base + perMP * mp;
    imageUSD = imagesNeeded * perImage;
    breakdown['hero_images'] = +imageUSD.toFixed(6);
  }

  const totalUSD = textUSD + imageUSD;

  return {
    input_tokens: Math.round(totalIn),
    output_tokens: Math.round(totalOut),
    images: imagesNeeded,
    minutes_audio: 0,
    estimated_cost_usd: +totalUSD.toFixed(6),
    breakdown,
  };
}
