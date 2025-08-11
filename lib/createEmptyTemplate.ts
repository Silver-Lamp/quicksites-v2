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

  // Seed a single page (no header/footer blocks inside the page body)
  const pages = [
    {
      id: 'index',
      slug: 'index',
      title: 'Home',
      show_header: true,
      show_footer: true,
      // page content starts with a hero; header/footer live globally on the template
      content_blocks: [createDefaultBlock('hero') as any],
    },
  ];

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
    headerBlock: createDefaultBlock('header') as any,
    footerBlock: createDefaultBlock('footer') as any,

    // Legacy readers may still look here
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
