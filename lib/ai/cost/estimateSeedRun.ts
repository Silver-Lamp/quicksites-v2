import type { SupabaseClient } from '@supabase/supabase-js';
import { estimateTemplateCost } from './estimate';
import { getPricing } from './pricing';

// quickSites-friendly defaults
const DEF_CHAT_PROVIDER = process.env.AI_DEFAULT_PROVIDER || 'openai';
const DEF_CHAT_MODEL    = process.env.AI_DEFAULT_MODEL    || 'gpt-4o-mini';
const DEF_IMG_PROVIDER  = 'openai';
const DEF_IMG_MODEL_HERO = 'gpt-image-1:medium';
const DEF_IMG_MODEL_PRODUCT = 'gpt-image-1:medium';

type TemplateLike = Parameters<typeof estimateTemplateCost>[0]['template'];

export type SeedRunOptions = {
  // counts & toggles
  productsCount: number;
  productPhotosAi?: boolean;

  // product image size as "1024x1024" etc.
  productImageSize?: string; // default 1024x1024
  productImagesPerItem?: number; // default 1

  // template gen toggle + optional draft template
  generateTemplate?: boolean;
  templateDraft?: TemplateLike | null;

  // text gen knobs
  providerChat?: string;
  modelChat?: string;
  profileCode?: 'BASIC'|'RICH'|'MAX';
  variantCount?: number;          // for hero/testimonials in template estimator

  // image gen knobs
  imageProviderHero?: string;
  imageModelHero?: string;
  heroImageWidth?: number;
  heroImageHeight?: number;
  heroImagesPerHeroBlock?: number;

  imageProviderProduct?: string;
  imageModelProduct?: string;
};

function parseDims(s?: string): { w: number; h: number } {
  const m = (s || '1024x1024').match(/(\d{3,5})\s*[xX×]\s*(\d{3,5})/);
  const w = m ? parseInt(m[1], 10) : 1024;
  const h = m ? parseInt(m[2], 10) : 1024;
  return { w, h };
}

// conservative per-product token assumptions (single pass)
const PRODUCT_INPUT_TOKENS  = 240; // prompt/system/context per product
const PRODUCT_OUTPUT_TOKENS = 320; // title + short desc + 3-5 bullets

// a light skeleton template if none is provided but template generation is enabled
function defaultTemplateSkeleton(): TemplateLike {
  return {
    id: 'tmp',
    pages: [
      { id: 'home', title: 'Home', blocks: [
        { type: 'hero', props: {} },
        { type: 'services', props: { items: new Array(4).fill(null) } },
        { type: 'faq', props: {} },
        { type: 'contact_form', props: {} },
      ]},
      { id: 'about', title: 'About', blocks: [{ type: 'page_header' }, { type: 'about' }] },
      { id: 'contact', title: 'Contact', blocks: [{ type: 'page_header' }, { type: 'contact_form' }] },
    ],
  };
}

export async function estimateSeedRunCost(
  supabaseAdmin: SupabaseClient<any, any, any>,
  opts: SeedRunOptions
) {
  const productsCount = Math.max(0, Number(opts.productsCount || 0));
  const productPhotos = !!opts.productPhotosAi;
  const productImagesPerItem = Math.max(0, Number(opts.productImagesPerItem ?? 1));
  const { w: prodW, h: prodH } = parseDims(opts.productImageSize);

  const providerChat = opts.providerChat || DEF_CHAT_PROVIDER;
  const modelChat    = opts.modelChat    || DEF_CHAT_MODEL;

  // ---------- TEXT: products ----------
  const chatPricing = await getPricing(providerChat, modelChat, 'chat');
  const prodIn  = productsCount * PRODUCT_INPUT_TOKENS;
  const prodOut = productsCount * PRODUCT_OUTPUT_TOKENS;
  const prodTextUSD =
    (prodIn / 1000)  * (chatPricing.input_per_1k_usd  ?? 0) +
    (prodOut / 1000) * (chatPricing.output_per_1k_usd ?? 0);

  // ---------- IMAGES: products ----------
  let prodImagesUSD = 0;
  let prodImagesCount = 0;
  if (productPhotos && productImagesPerItem > 0) {
    const imgProv = opts.imageProviderProduct || DEF_IMG_PROVIDER;
    const imgModel = opts.imageModelProduct || DEF_IMG_MODEL_PRODUCT;
    const imgPricing = await getPricing(imgProv, imgModel, 'image');
    const base = imgPricing.image_base_usd ?? 0;
    const perMp = imgPricing.image_per_mp_usd ?? 0;
    const mp = (prodW * prodH) / 1_000_000;
    const perImage = base + perMp * mp;
    prodImagesCount = productsCount * productImagesPerItem;
    prodImagesUSD = prodImagesCount * perImage;
  }

  // ---------- TEMPLATE ----------
  let tmplUSD = 0;
  let heroImagesUSD = 0;
  let heroImagesCount = 0;

  if (opts.generateTemplate) {
    const tmpl = opts.templateDraft || defaultTemplateSkeleton();
    const res = await estimateTemplateCost({
      entityType: 'template',
      entityId: 'seed-preview',
      provider: providerChat,
      model_code: modelChat,
      template: tmpl,
      profileCode: opts.profileCode || 'RICH',
      variantCount: opts.variantCount ?? 1,
      // image knobs for hero
      imageProvider: opts.imageProviderHero || (opts.imageModelHero ? DEF_IMG_PROVIDER : undefined),
      imageModel:    opts.imageModelHero    || DEF_IMG_MODEL_HERO,
      heroImageWidth:  opts.heroImageWidth ?? 1536,
      heroImageHeight: opts.heroImageHeight ?? 1024,
      heroImagesPerHeroBlock: opts.heroImagesPerHeroBlock ?? 1,
    } as any);

    tmplUSD = res.breakdown?.text_generation ?? 0;
    heroImagesUSD = res.breakdown?.hero_images ?? 0;
    heroImagesCount = res.images || 0;
  }

  const total =
    round6(prodTextUSD) +
    round6(prodImagesUSD) +
    round6(tmplUSD) +
    round6(heroImagesUSD);

  return {
    total: round4(total),
    breakdown: {
      products_text: round4(prodTextUSD),
      product_images: round4(prodImagesUSD),
      template_text: round4(tmplUSD),
      hero_images: round4(heroImagesUSD),
      counts: {
        products: productsCount,
        product_images: prodImagesCount,
        hero_images: heroImagesCount,
      },
    },
  };
}

function round6(n: number) { return +n.toFixed(6); }
function round4(n: number) { return +n.toFixed(4); }
