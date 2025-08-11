// lib/createTemplateFromPreset.ts
import { createDefaultPage } from '@/lib/pageDefaults';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { generateUniqueTemplateName, slugify } from '@/lib/utils/slug';
import { templateDefaults } from '@/lib/templateDefaults';
import type {
  ValidatedTemplate,
  ValidatedPage,
} from '@/admin/lib/zod/templateSaveSchema';

export const templatePresets = {
  Towing: ['hero', 'services', 'testimonial', 'cta'],
  Bakery: ['hero', 'image', 'quote', 'button'],
  Agency: ['hero', 'video', 'quote', 'grid'],
} as const;

// Preset + real blocks
export function createTemplateFromPresetWithBlocks(
  industry: keyof typeof templatePresets
): ValidatedTemplate {
  const name = generateUniqueTemplateName(industry);
  const slug = slugify(name);

  const blocks = templatePresets[industry].map((t) => createDefaultBlock(t));

  // Make the page explicit so TS knows show_header/show_footer are booleans
  const page: ValidatedPage = createDefaultPage({
    title: `${industry} Site`,
    slug: 'index',
    show_header: true,
    show_footer: true,
    content_blocks: blocks,
  });

  const tpl: ValidatedTemplate = {
    ...templateDefaults,
    id: '',
    slug,
    industry,
    layout: 'default',
    data: {
      ...(templateDefaults.data ?? {}),
      pages: [page],
    },
    services: [],
    template_name: name,
    color_scheme: 'neutral',
    theme: 'default',
    // keep root pages for legacy/null-safety; schema’s preprocessor ignores it
    pages: [],
  };

  return tpl;
}

// Generic starter preset
export function createTemplateFromPreset({
  industry = 'General',
  layout = 'default',
  brand = '',
}: {
  industry?: string;
  layout?: string;
  brand?: string;
}): ValidatedTemplate {
  const name = generateUniqueTemplateName(`${industry.toLowerCase()}-preset`);
  const slug = slugify(name);

  const starterPage: ValidatedPage = createDefaultPage({
    title: 'Welcome',
    slug: 'index',
    show_header: true,
    show_footer: true,
    content_blocks: [
      createDefaultBlock('hero'),
      createDefaultBlock('services'),
      createDefaultBlock('testimonial'),
      createDefaultBlock('cta'),
    ],
  });

  const tpl: ValidatedTemplate = {
    ...templateDefaults,
    id: '',
    slug,
    industry: 'General',
    layout,
    data: {
      ...(templateDefaults.data ?? {}),
      pages: [starterPage],
    },
    template_name: name,
    color_scheme: 'neutral',
    theme: 'default',
    pages: [],
    services: [],
  };

  return tpl;
}
