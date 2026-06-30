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
import { getIndustryPreset } from '@/lib/theme/industryPresets';

export type StarterTheme = {
  colorMode: 'light' | 'dark';
  accentColor?: string;
  fontFamily?: string;
  borderRadius?: string;
};

/** Per-industry theme derived from the canonical industry presets (accent,
 *  font, radius, light/dark). See lib/theme/industryPresets.ts. */
export function themeForIndustry(key: IndustryKey): StarterTheme {
  const p = getIndustryPreset(key);
  return {
    colorMode: p.darkMode === 'dark' ? 'dark' : 'light',
    accentColor: p.accentColor,
    fontFamily: p.fontFamily,
    borderRadius: p.borderRadius,
  };
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
export function buildIndustryStarter(opts: { businessName: string; industryKey: IndustryKey }) {
  const businessName = (opts.businessName || '').trim();
  const industryKey = opts.industryKey;
  const label = KEY_TO_LABEL[industryKey] ?? 'Other';
  const theme = themeForIndustry(industryKey);

  const base: any = createEmptyTemplate(businessName || label);

  // Industry services from the catalog (names are enough for the renderer).
  const serviceNames = generateServices({ industryKey }).map((s) => s.name);

  // Hero — override only known content keys.
  const hero: any = createDefaultBlock('hero');
  hero.content = hero.content ?? {};
  setIfPresent(hero.content, 'headline', businessName || label);
  setIfPresent(hero.content, 'subheadline', `Trusted ${label.toLowerCase()} — get a fast, free quote.`);
  setIfPresent(hero.content, 'cta_text', 'Get a Quote');

  // Services — seed items into whichever array shape the default block uses.
  const services: any = createDefaultBlock('services');
  services.content = services.content ?? {};
  if (Array.isArray(services.content.items)) {
    services.content.items = serviceNames.map((name) => ({ name }));
  } else if (Array.isArray(services.content.services)) {
    services.content.services = serviceNames.map((name) => ({ name }));
  }

  const faq: any = createDefaultBlock('faq');
  const contact: any = createDefaultBlock('contact_form');

  // Commerce-forward industries get a storefront grid up top (e.g. authors selling
  // books + merch). Reuses the existing products_grid block.
  const STOREFRONT_INDUSTRIES = new Set<IndustryKey>([
    'author', 'retail_boutique', 'retail_home_goods', 'handmade', 'etsy_style', 'print_on_demand', 'custom_apparel',
  ]);
  const blocks = STOREFRONT_INDUSTRIES.has(industryKey)
    ? [hero, createDefaultBlock('products_grid') as any, services, faq, contact]
    : [hero, services, faq, contact];
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
        // Persist the industry theme so the renderer/editor theme layer can read it.
        theme: {
          accentColor: theme.accentColor,
          fontFamily: theme.fontFamily,
          borderRadius: theme.borderRadius,
          darkMode: theme.colorMode,
        },
      },
    },
  };
}
