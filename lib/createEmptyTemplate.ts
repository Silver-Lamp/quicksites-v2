// lib/createEmptyTemplate.ts
import type { Template } from '@/types/template';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

function generateSlug(base: string) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}
function generateUniqueSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

export function createEmptyTemplate(base = 'new-template'): Template {
  const slug = `${generateSlug(base)}-${generateUniqueSuffix()}`;
  const now = new Date().toISOString();

  // Default content blocks
  const defaultHero = createDefaultBlock('hero') as any;
  const headerBlock = createDefaultBlock('header') as any;
  const footerBlock = createDefaultBlock('footer') as any;

  // Seed a single Home page (legacy + canonical)
  const homePage = {
    id: crypto.randomUUID(),
    slug: 'index',
    path: '/',
    title: 'Home',
    show_header: true,
    show_footer: true,
    // Legacy readers:
    content_blocks: [defaultHero],
    // Canonical runtime/editor:
    blocks: [defaultHero],
  };
  const pages = [homePage];

  return {
    id: crypto.randomUUID(),
    template_name: slug,
    slug,
    layout: 'standard',
    color_scheme: 'neutral',
    theme: 'default',
    brand: 'default',
    commit: '',

    // ❌ Do NOT set industry or site_type here (either top-level or in meta).
    // industry: undefined,
    // industry_label: undefined,
    // site_type: undefined,

    hero_url: '',
    banner_url: '',
    logo_url: '',
    team_url: '',
    is_site: false,
    published: false,
    verified: false,
    created_at: now,
    updated_at: now,
    domain: '',
    custom_domain: '',
    services: [],

    // Legacy mirror for older UIs
    pages,

    // Optional marketing meta (no industry fields)
    meta: {
      title: slug,
      description: `Website template for ${slug}`,
      ogImage: '',
      faviconSizes: '',
      appleIcons: '',
    },

    // Canonical data bag used by editor/runtime
    data: {
      // Keep header/footer accessible in data (create API can also lift to columns)
      headerBlock,
      footerBlock,

      services: [],
      pages, // keep in sync with top-level `pages`

      // Provide meta, but DO NOT include industry keys here.
      meta: {
        identity: {},
        services: [],
        siteTitle: null,
        site_type: null, // let UI set this later
        contact: {
          email: null,
          phone: null,
          address: null,
          address2: null,
          city: null,
          state: null,
          postal: null,
          latitude: null,
          longitude: null,
        },
        // ❌ no industry / industry_label / industry_other
      },

      // color_mode omitted intentionally; UI/runtime can decide
    },

    // Columns your create API may serialize (included for typing convenience)
    headerBlock,
    footerBlock,
  } as unknown as Template;
}
