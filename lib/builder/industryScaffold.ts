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

/** Industries that read better dark (rugged/automotive/after-hours trades). */
const DARK_INDUSTRIES = new Set<IndustryKey>([
  'towing',
  'auto_repair',
  'windshield_repair',
  'electrical',
  'general_contractor',
  'junk_removal',
]);

export type StarterTheme = { colorMode: 'light' | 'dark' };

/** Conservative theming: vary light/dark by industry (a safe, visible default;
 *  palette/typography presets can be layered on later). */
export function themeForIndustry(key: IndustryKey): StarterTheme {
  return { colorMode: DARK_INDUSTRIES.has(key) ? 'dark' : 'light' };
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

  const blocks = [hero, services, faq, contact];
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
      },
    },
  };
}
