import { slugify } from './slugs';
import { makeSeededBlock, makeDefaultBlock, validateBlock } from '@/lib/blockRegistry.core';
import type { SeedContext, Block } from '@/types/blocks';

export type TemplateLayout = 'standard' | 'onepage';
export type TemplateTheme  = 'light' | 'dark';

export type TemplatePreview = {
  name: string;
  slug: string;
  data: any;                 // modern editor shape
  hero_data_url?: string | null;
};

function pickAccent(industry?: string) {
  const map: Record<string, string> = {
    'Retail - Boutique': '#7C3AED',
    Crafts: '#DB2777',
    'Retail - Home Goods': '#0EA5E9',
    'Retail - Electronics': '#0EA5E9',
  };
  return map[industry || ''] || '#6366F1';
}

// safe id helper (SSR/edge/browser)
function genId() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  return g.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

/* ----------------------------------------------------------------------------
  props → content mappers (modernize registry output)
---------------------------------------------------------------------------- */

function ensureHeroDefaults(c: Record<string, any>) {
  if (!c.headline) c.headline = 'Welcome';
  if (!('subheadline' in c)) c.subheadline = '';
  if (!('cta_text' in c)) c.cta_text = 'Get Started';
  if (!('cta_link' in c)) c.cta_link = '/contact';
  if (!c.layout_mode) c.layout_mode = 'inline';
  if (!c.image_position) c.image_position = 'center';
  if (typeof c.blur_amount !== 'number') c.blur_amount = 8;
  if (typeof c.parallax_enabled !== 'boolean') c.parallax_enabled = false;
  if (!c.mobile_layout_mode) c.mobile_layout_mode = 'inline';
  if (!c.mobile_crop_behavior) c.mobile_crop_behavior = 'cover';
}

function toModernHero(block: any, siteName: string, tagline?: string | null, heroUrl?: string | null) {
  const p = (block?.props ?? {}) as Record<string, any>;
  const content = {
    headline: p.heading ?? siteName ?? 'Welcome',
    subheadline: p.subheading ?? (tagline ?? ''),
    cta_text: p.ctaLabel ?? 'Get Started',
    cta_link: p.ctaHref ?? '#contact',
    image_url: heroUrl ?? p.heroImage ?? '',
    layout_mode: p.layout_mode ?? 'inline',
    image_position: p.image_position ?? 'center',
    blur_amount: typeof p.blur_amount === 'number' ? p.blur_amount : 8,
    parallax_enabled: typeof p.parallax_enabled === 'boolean' ? p.parallax_enabled : false,
    mobile_layout_mode: p.mobile_layout_mode ?? 'inline',
    mobile_crop_behavior: p.mobile_crop_behavior ?? 'cover',
  };
  ensureHeroDefaults(content);
  return { type: 'hero' as const, _id: block?.id || genId(), tone: 'neutral', content };
}

function toModernServices(block: any, opts?: { title?: string; columns?: number }) {
  const p = (block?.props ?? {}) as Record<string, any>;
  const items = Array.isArray(p.items)
    ? p.items.map((i: any) => ({ name: i?.name ?? '', description: i?.description ?? '' }))
    : [];
  const content = {
    title: typeof p.title === 'string' && p.title.trim() ? p.title : (opts?.title ?? 'Our Services'),
    columns: Math.max(1, Math.min(6, Number(p.columns ?? (opts?.columns ?? 3)))),
    items,
  };
  return { type: 'services' as const, _id: block?.id || genId(), tone: 'neutral', content };
}

function toModernText(block: any, fallbackHtml = '') {
  const p = (block?.props ?? {}) as Record<string, any>;
  const html = typeof p.html === 'string' && p.html.trim() ? p.html : fallbackHtml;
  const content = { format: 'html' as const, html, json: undefined, summary: undefined, word_count: undefined };
  return { type: 'text' as const, _id: block?.id || genId(), tone: 'neutral', content };
}

function toModernContact(block: any, heading: string) {
  const p = (block?.props ?? {}) as Record<string, any>;
  const content = { title: p?.title ?? heading, services: Array.isArray(p?.services) ? p.services : undefined };
  return { type: 'contact_form' as const, _id: block?.id || genId(), tone: 'neutral', content };
}

/* ----------------------------------------------------------------------------
  Template builder – emits modern editor shape
---------------------------------------------------------------------------- */

export function buildTemplatePreview(opts: {
  brand: {
    name?: string;
    tagline?: string | null;
    about?: string | null;
    logo_url?: string | null;
    hero_data_url?: string | null;
    city?: string | null;
    state?: string | null;
  };
  products: Array<{
    title?: string;
    price_usd?: number;
    image_url?: string | null;
    image_data_url?: string | null;
    blurb?: string | null;
  }>;
  industry?: string;
  layout?: TemplateLayout;
  theme?: TemplateTheme;
  nameSeed?: string;
}): TemplatePreview {
  const {
    brand,
    products,
    industry,
    layout = 'standard',
    theme = 'light',
    nameSeed = 'Demo Site',
  } = opts;

  const siteName = brand?.name || nameSeed;
  const name = `${siteName} — Demo`;
  const slug = slugify(`${siteName}-demo`);
  const hero = (brand?.hero_data_url as string | undefined) || null;
  const accent = pickAccent(industry);

  // SeedContext to feed your registry (services factory may look at ctx.products/services)
  const ctx: SeedContext = {
    id: genId,
    random: Math.random,
    industry,
    merchant: {
      name: siteName,
      tagline: brand?.tagline ?? undefined,
      about: brand?.about ?? undefined,
      logo_url: brand?.logo_url ?? undefined,
      city: brand?.city ?? undefined,
      state: brand?.state ?? undefined,
      images: { hero: hero ?? undefined },
    },
    products: (products ?? []).map((p) => ({
      name: p.title ?? '',
      description: p.blurb ?? undefined,
      price: typeof p.price_usd === 'number' ? p.price_usd : undefined,
      image: p.image_url ?? p.image_data_url ?? undefined,
    })),
    assets: { hero: hero ?? undefined, palette: { accent } },
    locale: { city: brand?.city ?? undefined, state: brand?.state ?? undefined },
  };

  /* ---------- Build via registry, then convert to modern content blocks ---------- */

  // HERO
  let heroBlock = makeDefaultBlock('hero', ctx);
  if (heroBlock) {
    // Patch legacy props for the validator (if it expects props)
    heroBlock = {
      ...heroBlock,
      id: heroBlock.id || genId(),
      props: {
        ...(heroBlock.props as any),
        heading: siteName,
        subheading: brand?.tagline || 'Curated looks, modern essentials.',
        ctaLabel: 'Shop Now',
        ctaHref: '#services',
        heroImage: hero,
        overlay: true,
      },
    } as Block;
    const v = validateBlock(heroBlock);
    heroBlock = v.ok ? v.value : heroBlock;
  }
  const heroModern = heroBlock ? toModernHero(heroBlock, siteName, brand?.tagline, hero) : null;

  // SERVICES (alias services_grid → services)
  let servicesBlock = makeSeededBlock('services_grid', ctx);
  if (Array.isArray(servicesBlock)) servicesBlock = servicesBlock[0];
  const servicesModern = servicesBlock ? toModernServices(servicesBlock, { title: 'Our Services', columns: 3 }) : null;
  if (servicesModern) (servicesModern as any)._id = (servicesBlock as any)?.id || 'services';

  // ABOUT (alias → text)
  let aboutBlock = makeSeededBlock('about', ctx);
  if (Array.isArray(aboutBlock)) aboutBlock = aboutBlock[0];
  const aboutModern = aboutBlock
    ? toModernText(
        aboutBlock,
        `<h2>About ${siteName}</h2><p>${brand?.about ?? 'We are your local experts.'}</p>`,
      )
    : null;

  // CONTACT FORM
  let contactBlock = makeDefaultBlock('contact_form', ctx);
  if (contactBlock) {
    contactBlock = {
      ...contactBlock,
      props: { ...(contactBlock.props as any), heading: 'Say Hello' },
    } as Block;
    const v = validateBlock(contactBlock);
    contactBlock = v.ok ? v.value : contactBlock;
  }
  const contactModern = contactBlock ? toModernContact(contactBlock, 'Say Hello') : null;

  // Final modern blocks used by the editor
  const content_blocks = [heroModern, servicesModern, aboutModern].filter(Boolean);

  const data = {
    meta: {
      layout,
      theme,
      accent,
      siteTitle: siteName,
      tagline: brand?.tagline || 'Elevate Your Everyday Style',
      city: brand?.city || null,
      state: brand?.state || null,
      logo: brand?.logo_url || null,
    },
    // IMPORTANT: modern shape with content_blocks and show_header/show_footer
    pages: [
      {
        id: 'home',
        slug: 'home',
        title: 'Home',
        show_footer: true,
        show_header: true,
        content_blocks,
      },
      {
        id: 'contact',
        slug: 'contact',
        title: 'Contact',
        show_footer: true,
        show_header: true,
        content_blocks: contactModern ? [contactModern] : [],
      },
    ],
    // simple header/footer preview objects for your preview UI
    header: { nav: [{ label: 'Home', href: '/' }, { label: 'Contact', href: '/contact' }] },
    footer: { text: `© ${new Date().getFullYear()} ${siteName}` },
  };

  return { name, slug, data, hero_data_url: hero };
}

/** Update hero image URL in modern content shape + keep legacy preview blocks in sync (if any). */
export function swapHeroInTemplate(template: TemplatePreview, heroUrl?: string | null): TemplatePreview {
  if (!heroUrl) return template;
  const copy = structuredClone(template);

  for (const page of copy.data?.pages || []) {
    // modern editor shape
    for (const block of page?.content_blocks || []) {
      if (block?.type === 'hero' && block?.content) {
        block.content.image_url = heroUrl;
      }
    }
    // if some preview UI still reads a legacy "blocks" array, keep it in sync (best-effort)
    if (Array.isArray((page as any).blocks)) {
      for (const b of (page as any).blocks) {
        if (b?.type === 'hero' && b?.props && 'heroImage' in b.props) {
          b.props.heroImage = heroUrl;
        }
      }
    }
  }
  copy.hero_data_url = null;
  return copy;
}
