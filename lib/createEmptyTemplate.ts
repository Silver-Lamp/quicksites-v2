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
    meta: {
      title: slug,
      description: `Website template for ${slug}`,
      ogImage: '',
      faviconSizes: '',
      appleIcons: '',
    },
    // ✅ Wrap layout in `.data` instead of flattening it
    data: {
      services: [],
      pages: [
        {
          id: 'index',
          slug: 'index',
          title: 'Home',
          show_header: true,
          show_footer: true,
          content_blocks: [createDefaultBlock('hero') as any],
        },
      ],
    },
  };
}
