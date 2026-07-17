// lib/builder/industryScaffold.ts
//
// First-run "pick your industry" scaffold (no AI). Builds a ready-to-edit
// starter site for a chosen industry: a sensible page (hero/services/faq/contact),
// industry services seeded from the catalog, business identity in meta, and a
// light light/dark theme. Pure + client-safe — posted to /api/templates/create.

import { createEmptyTemplate } from '@/lib/createEmptyTemplate';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { generateServices } from '@/lib/generateServices';
import { pickCuratedTheme } from '@/lib/theme/pickTheme';
import { getCuratedTheme, toStampedTheme, type StampedTheme, type ThemeCategory, type ThemeLayout } from '@/lib/theme/curatedThemes';
import { industryStyle } from '@/lib/builder/industryStyle';
import { pickHeroCopy, pickFaqItems, pickTestimonials } from '@/lib/builder/industryCopy';

export type StarterTheme = {
  colorMode: 'light' | 'dark';
  /** Full theme bag stamped into data.meta.theme (accent/secondary/neutral/
   *  fontPair/radius/surface/mode/layout). */
  stamped: StampedTheme;
  category: ThemeCategory;
};

/** Industry-weighted curated theme for a new site — random so sites don't all
 *  look alike. Pass `themeId` to force a specific curated theme (reshuffle/tests).
 *  See lib/theme/curatedThemes.ts + lib/theme/pickTheme.ts. */
export function themeForIndustry(key: IndustryKey, themeId?: string | null): StarterTheme {
  const curated = getCuratedTheme(themeId) ?? pickCuratedTheme({ industry: key });
  return { colorMode: curated.darkMode, stamped: toStampedTheme(curated), category: curated.category };
}

/**
 * Page composition archetype for a standard service business — varies which
 * blocks appear and in what order so generated sites aren't all the same stack.
 * Weighted by the theme's category so structure matches the visual feel.
 */
export type Archetype =
  | 'classic'
  | 'story_led'
  | 'proof_led'
  | 'conversion'
  | 'showcase'      // long-form: everything, for a comprehensive brand page
  | 'benefits_led'  // lead with the story/benefits + an early CTA, services after
  | 'trust_first';  // social proof up top, then services

const ARCHETYPE_WEIGHTS: Record<ThemeCategory, Partial<Record<Archetype, number>>> = {
  editorial:    { story_led: 3, showcase: 2, classic: 1 },
  warm:         { story_led: 2, proof_led: 2, benefits_led: 2, classic: 1 },
  professional: { classic: 2, proof_led: 2, showcase: 1, trust_first: 1 },
  playful:      { conversion: 2, proof_led: 1, benefits_led: 2, classic: 1 },
  neon:         { conversion: 2, proof_led: 1, trust_first: 1 },
  rugged:       { classic: 2, conversion: 2, benefits_led: 1, trust_first: 1 },
};

// Industry personality nudges the archetype on top of the theme-category base,
// so a landscaper reads visual/proof-forward while a lawyer reads trust-forward —
// independent of which theme happened to be drawn. Classification is shared with
// the copy picker via industryStyle().
function industryArchetypeBias(key?: IndustryKey | null): Partial<Record<Archetype, number>> {
  switch (industryStyle(key)) {
    case 'visual':  return { showcase: 2, story_led: 2, proof_led: 1 };
    case 'trust':   return { trust_first: 2, proof_led: 2, classic: 1 };
    case 'urgency': return { conversion: 2, proof_led: 1 };
    default:        return {};
  }
}

export function pickArchetype(
  category: ThemeCategory,
  industryOrRng?: IndustryKey | (() => number) | null,
  rng: () => number = Math.random,
): Archetype {
  // Back-compat: pickArchetype(category, rng) is still supported.
  const industry = typeof industryOrRng === 'function' ? null : industryOrRng ?? null;
  const rand = typeof industryOrRng === 'function' ? industryOrRng : rng;

  const base = ARCHETYPE_WEIGHTS[category] ?? { classic: 1 };
  const bias = industryArchetypeBias(industry);
  const merged: Partial<Record<Archetype, number>> = { ...base };
  for (const [a, w] of Object.entries(bias) as [Archetype, number][]) {
    merged[a] = (merged[a] ?? 0) + w;
  }

  const entries = Object.entries(merged) as [Archetype, number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [a, w] of entries) {
    r -= w;
    if (r < 0) return a;
  }
  return entries[entries.length - 1]?.[0] ?? 'classic';
}

/** Map the theme's preferred hero shape onto the hero block's layout_mode. */
function applyHeroLayout(hero: any, layout: ThemeLayout) {
  const mode = layout.heroLayout === 'full_bleed' ? 'full_bleed' : 'inline';
  if (hero?.content) hero.content.layout_mode = mode;
}

function uid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id_${Math.random().toString(36).slice(2)}`;
}

/** Only overwrite a key the default block already declares (stays schema-safe). */
function setIfPresent(obj: any, key: string, val: any) {
  if (obj && Object.prototype.hasOwnProperty.call(obj, key)) obj[key] = val;
}

/**
 * Build a starter site payload for /api/templates/create from an industry +
 * business name. Returns an object shaped like the create route's `initial`.
 */
export function buildIndustryStarter(opts: { businessName: string; industryKey: IndustryKey; themeId?: string | null }) {
  const businessName = (opts.businessName || '').trim();
  const industryKey = opts.industryKey;
  const label = KEY_TO_LABEL[industryKey] ?? 'Other';
  const theme = themeForIndustry(industryKey, opts.themeId);

  const base: any = createEmptyTemplate(businessName || label);

  // Industry services from the catalog (names are enough for the renderer).
  const serviceNames = generateServices({ industryKey }).map((s) => s.name);

  // Varied, industry-appropriate hero copy so two sites don't read identically.
  const copy = pickHeroCopy({ industryKey, label, businessName });

  // Hero — override only known content keys.
  const hero: any = createDefaultBlock('hero');
  hero.content = hero.content ?? {};
  setIfPresent(hero.content, 'headline', businessName || label);
  setIfPresent(hero.content, 'subheadline', copy.subheadline);
  setIfPresent(hero.content, 'cta_text', copy.ctaText);

  // Services — seed items into whichever array shape the default block uses.
  const services: any = createDefaultBlock('services');
  services.content = services.content ?? {};
  if (Array.isArray(services.content.items)) {
    services.content.items = serviceNames.map((name) => ({ name }));
  } else if (Array.isArray(services.content.services)) {
    services.content.services = serviceNames.map((name) => ({ name }));
  }

  const faq: any = createDefaultBlock('faq');
  faq.content = faq.content ?? {};
  // Seed industry-appropriate FAQ items (default is a single generic Q&A).
  faq.content.items = pickFaqItems({ industryKey, businessName, label });
  const contact: any = createDefaultBlock('contact_form');

  // Commerce-forward industries get a storefront grid up top (e.g. authors selling
  // books + merch). Reuses the existing products_grid block.
  const STOREFRONT_INDUSTRIES = new Set<IndustryKey>([
    'author', 'retail_boutique', 'retail_home_goods', 'handmade', 'etsy_style', 'print_on_demand', 'custom_apparel',
    'crafts', 'artisan_goods', 'gifts_stationery',
    // retail/resale — anything whose site should lead with sellable goods
    'retail_electronics', 'retail_thrift', 'art_supplies', 'antiques_vintage', 'collectibles',
    'pet_boutique', 'pop_up_shop', 'farmers_market_vendor', 'online_reseller',
  ]);
  // Food industries get a menu-forward layout (menu + hours) instead of a services
  // list — this is what makes a restaurant site read like an ordering site.
  const FOOD_INDUSTRIES = new Set<IndustryKey>(['restaurant']);

  // Hero shape follows the theme's layout personality (all paths).
  applyHeroLayout(hero, theme.stamped.layout);

  let blocks: any[];
  if (FOOD_INDUSTRIES.has(industryKey)) {
    // Restaurant: menu + hours; the hero points at the menu rather than a quote.
    setIfPresent(hero.content, 'headline', businessName || label);
    setIfPresent(hero.content, 'subheadline', 'Fresh food, made daily — order online or stop by.');
    setIfPresent(hero.content, 'cta_text', 'View Menu');
    // Same-page anchor: the public renderer stamps first-of-type block ids
    // (#menu/#location/#contact), so the CTA scrolls instead of dead-linking.
    setIfPresent(hero.content, 'cta_link', '#menu');

    const menu: any = createDefaultBlock('menu');
    menu.content = {
      ...menu.content,
      title: 'Our Menu',
      sections: [
        {
          name: 'Breakfast',
          description: '',
          items: [
            { name: 'Two Eggs Any Style', description: 'With toast and breakfast potatoes.', price: '$11', tags: [] },
            { name: 'Buttermilk Pancakes', description: 'Stack of three, real maple syrup.', price: '$10', tags: [] },
          ],
        },
        {
          name: 'Lunch',
          description: '',
          items: [
            { name: 'House Burger', description: 'Cheddar, lettuce, tomato, house sauce, fries.', price: '$14', tags: ['Popular'] },
            { name: 'Garden Salad', description: 'Seasonal greens and vegetables.', price: '$9', tags: ['V'] },
          ],
        },
        {
          name: 'Dinner',
          description: '',
          items: [
            { name: 'Signature Entrée', description: 'Describe your best seller here.', price: '$19', tags: [] },
          ],
        },
      ],
    };
    const location: any = createDefaultBlock('location');
    location.content = { ...location.content, business_name: businessName || label };
    const hours: any = createDefaultBlock('hours');
    const orderBar: any = createDefaultBlock('order_bar');

    // No FAQ on a restaurant site — diners want the menu, hours, and a way to order;
    // generic Q&A filler dilutes that. The contact form earns its place by carrying
    // the real restaurant use-case: catering / private-event inquiries.
    contact.content = { ...contact.content, title: 'Questions? Catering? Get in touch' };

    // Restaurant chrome: the default Home/Services/Contact nav points at pages a
    // one-page ordering site doesn't have. Swap header + footer nav to same-page
    // anchors (renderer stamps first-of-type block ids).
    const foodNav = [
      { label: 'Menu', href: '#menu', appearance: 'default' },
      { label: 'Location & Hours', href: '#location', appearance: 'default' },
      { label: 'Contact', href: '#contact', appearance: 'default' },
    ];
    const headerBlk: any = (base as any)?.data?.headerBlock ?? (base as any)?.headerBlock;
    if (headerBlk?.content && Array.isArray(headerBlk.content.nav_items)) {
      headerBlk.content.nav_items = foodNav.map((l) => ({ ...l }));
    }
    const footerBlk: any = (base as any)?.data?.footerBlock ?? (base as any)?.footerBlock;
    if (footerBlk?.content && Array.isArray(footerBlk.content.links)) {
      footerBlk.content.links = foodNav.map((l) => ({ ...l }));
    }

    blocks = [hero, menu, location, hours, contact, orderBar];
  } else if (industryKey === 'personal') {
    // "About Me" personal site — audio-forward, no services/FAQ. The differentiator
    // is HiveJournal's owner-voice moat: the page can talk in your own voice via an
    // EmberKiln clone. Ships with the voice + Q&A slots (empty until the person
    // records a clone) and a nudge to record one. See crosstalk ideas.md §13.
    const who = businessName || label;
    setIfPresent(hero.content, 'headline', who);
    setIfPresent(hero.content, 'subheadline', `Hi, I’m ${who} — here’s a little about me.`);
    setIfPresent(hero.content, 'cta_text', 'Get in touch');
    setIfPresent(hero.content, 'cta_link', '#contact');

    const bio: any = createDefaultBlock('story');
    bio.content = {
      ...bio.content,
      title: 'About me',
      sections: [
        {
          heading: `A bit about ${who}`,
          body: 'Share who you are, what you care about, and what you’re working on. This is your story in your words — or paste your LinkedIn / about.me and we’ll draft it for you.',
          image_url: '', cta_text: '', cta_link: '',
        },
      ],
    };

    // Voice "about me" — the HJ Voice Welcome player. Ships silent (no audio_url);
    // becomes the narrator-default hello once a welcome is created, then upgrades to the
    // person's own voice after they record a clone. HJ confirmed this IS the "about-me
    // audio by default" (voice_welcome endpoint LIVE, HJ #1326; ideas.md §13).
    const voiceAbout: any = createDefaultBlock('voice_welcome');

    // Ask-me-anything in your own voice (HJ /ask). Optional; empty until configured.
    const askMe: any = createDefaultBlock('audio_faq');

    // The nudge: turn this page into one that talks in YOUR voice. Points at HJ's
    // consented clone-recording flow (EmberKiln / lovio voice setup; HJ confirmed this
    // deep-link, ideas.md §13). A ?name= prefill is a small future add.
    const cloneNudge: any = createDefaultBlock('cta');
    cloneNudge.content = {
      ...cloneNudge.content,
      label: 'Record your voice — make this page talk',
      link: 'https://hivejournal.com/dashboard/lovio/voice-setup',
    };

    blocks = [hero, bio, voiceAbout, askMe, cloneNudge, contact];
  } else if (STOREFRONT_INDUSTRIES.has(industryKey)) {
    blocks = [hero, createDefaultBlock('products_grid') as any, services, faq, contact];
  } else {
    // Standard service business: pick a composition archetype so sites don't all
    // read as the same hero→services→faq→contact stack. Woven-in blocks
    // (story/testimonial/cta) are all theme-token colored (Phase B).
    const makeStory = () => {
      const b: any = createDefaultBlock('story');
      b.content = {
        ...b.content,
        title: `About ${businessName || label}`,
        sections: [
          {
            heading: `Why choose ${businessName || label}?`,
            body: `We're a local ${label.toLowerCase()} team dedicated to quality work and honest service. Share what makes you different here.`,
            image_url: '',
            cta_text: '',
            cta_link: '',
          },
        ],
      };
      return b;
    };
    const makeTestimonial = () => {
      const b: any = createDefaultBlock('testimonial');
      b.content = b.content ?? {};
      // Seed industry-flavored testimonials (default is a single generic quote).
      b.content.testimonials = pickTestimonials({ industryKey, businessName });
      return b;
    };
    const makeCta = () => {
      const b: any = createDefaultBlock('cta');
      b.content = { ...b.content, label: copy.ctaText, link: '#contact' };
      return b;
    };

    const archetype = pickArchetype(theme.category, industryKey);
    switch (archetype) {
      case 'story_led':
        blocks = [hero, makeStory(), services, makeTestimonial(), contact];
        break;
      case 'proof_led':
        blocks = [hero, services, makeTestimonial(), faq, makeCta(), contact];
        break;
      case 'conversion':
        blocks = [hero, services, makeCta(), faq, contact];
        break;
      case 'showcase':
        // Comprehensive long-form brand page — the fullest stack.
        blocks = [hero, makeStory(), services, makeTestimonial(), faq, makeCta(), contact];
        break;
      case 'benefits_led':
        // Story/benefits + an early CTA, then services and FAQ.
        blocks = [hero, makeStory(), makeCta(), services, faq, contact];
        break;
      case 'trust_first':
        // Social proof leads, then services and the brand story.
        blocks = [hero, makeTestimonial(), services, makeStory(), makeCta(), contact];
        break;
      case 'classic':
      default:
        blocks = [hero, services, faq, contact];
        break;
    }
  }

  // Real estate: an AGENT site — a portfolio of homes (each with an About That
  // audio-tour slot) right after the hero, then a featured single listing. QuickSites
  // becomes the on-domain listing pages most agent sites lack, and the audio tours are
  // the differentiator (agent talks through each home in their voice). Strategic
  // pairing with HiveJournal's real-estate tier — see BLOCKS_BACKLOG.md §4.
  if (industryKey === 'real_estate') {
    blocks.splice(1, 0, createDefaultBlock('listings_grid') as any, createDefaultBlock('listing_card') as any);
  }

  // General contractors + deck builders get the DeckSketch instant-estimate widget
  // after the hero — homeowner enters dimensions, gets a ballpark materials range, the
  // builder gets a qualified lead. The seam behind the DeckSketch↔QS pitch
  // (crosstalk/contracts/deck-estimate-embed.md). Owner sets the lead recipient email.
  if (industryKey === 'general_contractor' || industryKey === 'deck_builder') {
    blocks.splice(1, 0, createDefaultBlock('deck_estimate') as any);
  }

  // Deck builders are a first-class DeckSketch outreach vertical: after the estimator,
  // a "Recent Decks" portfolio (project spotlights with image slots ready for the
  // builder's real photos — or DeckSketch-provided reference decks). Image URLs left
  // empty so the editor's "add your project photos" prompt shows; copy is deck-specific.
  if (industryKey === 'deck_builder') {
    const portfolio: any = createDefaultBlock('story');
    portfolio.content = {
      ...portfolio.content,
      title: 'Recent Decks',
      sections: [
        {
          heading: 'Multi-level cedar deck with built-in seating',
          body: 'A sloped backyard turned into two living levels — cedar decking, wraparound bench seating, and planter boxes. Sample projects shown to illustrate the style; every deck we build is custom, so swap in your own photos once you claim the site.',
          image_url: '/images/deck-portfolio/cedar.jpg', cta_text: 'Start your estimate', cta_link: '#deck-estimate',
        },
        {
          heading: 'Low-maintenance composite deck & railing',
          body: 'Composite boards and dark metal railing for a deck that never needs staining. Great for busy families who want the look without the upkeep.',
          image_url: '/images/deck-portfolio/composite.jpg', cta_text: '', cta_link: '',
        },
        {
          heading: 'Poolside pressure-treated deck',
          body: 'A durable, budget-friendly pressure-treated deck beside the pool — clean railing, wide landings, and room to lounge.',
          image_url: '/images/deck-portfolio/pressure-treated.jpg', cta_text: '', cta_link: '',
        },
      ],
    };
    // After the estimator (which is now at index 1), so: hero → estimate → portfolio.
    blocks.splice(2, 0, portfolio);
  }

  // Split-layout themes (heroLayout: 'split' — warm/professional) get a real
  // side-by-side "About | Why choose us" section after the hero, so the page
  // isn't a pure vertical stack (L4 sections; see docs/LAYOUT_L4_PLAN.md).
  if (theme.stamped.layout?.heroLayout === 'split' && blocks.length > 1 && !FOOD_INDUSTRIES.has(industryKey) && industryKey !== 'personal') {
    const bn = businessName || label;
    const aboutCol: any = createDefaultBlock('text');
    aboutCol.content = {
      ...aboutCol.content,
      value: `<h3>About ${bn}</h3><p>We're a local ${label.toLowerCase()} team dedicated to quality work and honest, dependable service. Share your story and what sets you apart here.</p>`,
    };
    const highlightsCol: any = createDefaultBlock('text');
    highlightsCol.content = {
      ...highlightsCol.content,
      value: `<h3>Why choose us</h3><ul><li>Licensed &amp; insured</li><li>Fast, friendly service</li><li>Satisfaction guaranteed</li></ul>`,
    };
    const splitSection: any = createDefaultBlock('section');
    splitSection.content = {
      ...splitSection.content,
      columns: [{ span: 1, items: [aboutCol] }, { span: 1, items: [highlightsCol] }],
      gap: 'lg',
      align: 'start',
    };
    blocks.splice(1, 0, splitSection);
  }

  const homePage = {
    id: uid(),
    slug: 'index',
    path: '/',
    title: 'Home',
    show_header: true,
    show_footer: true,
    content_blocks: blocks, // legacy readers
    blocks, // canonical
  };
  const pages = [homePage];

  const baseData: any = base.data ?? {};
  const baseMeta: any = baseData.meta ?? {};

  return {
    ...base,
    template_name: businessName || label,
    is_site: true,
    color_mode: theme.colorMode,
    services: serviceNames,
    pages,
    meta: {
      ...(base.meta ?? {}),
      title: businessName || label,
      description: `${label} services${businessName ? ` from ${businessName}` : ''}`,
    },
    data: {
      ...baseData,
      pages,
      services: serviceNames,
      color_mode: theme.colorMode,
      meta: {
        ...baseMeta,
        siteTitle: businessName || label,
        business_name: businessName || null,
        industry: industryKey,
        industry_label: label,
        services: serviceNames,
        // Persist the curated theme so the renderer/editor theme layer can read it.
        theme: theme.stamped,
      },
    },
  };
}
