// lib/createEmptyTemplate.ts
import type { Template } from '@/types/template';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

function generateSlug(base: string) {
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').trim();
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

  // Seed a single Home page (header/footer are global; not part of page body)
  const homePage = {
    id: crypto.randomUUID(),
    slug: 'index',
    path: '/',                 // many renderers prefer a canonical path
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
    industry: 'general',
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

    // Global site-wide chrome (single source of truth)
    headerBlock,
    footerBlock,

    // Legacy top-level mirror (kept for backwards compatibility)
    pages,

    meta: {
      title: slug,
      description: `Website template for ${slug}`,
      ogImage: '',
      faviconSizes: '',
      appleIcons: '',
    },

    // Canonical location for editor/runtime data
    data: {
      services: [],
      pages, // keep in sync with top-level `pages`
      // color_mode intentionally not defaulted; editor/runtime decides fallback
    },
  } as Template;
}
