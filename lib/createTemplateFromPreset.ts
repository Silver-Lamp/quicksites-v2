// lib/createTemplateFromPreset.ts
import { createDefaultPage } from '@/lib/pageDefaults';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { generateUniqueTemplateName, slugify } from '@/lib/utils/slug';
import { templateDefaults } from '@/lib/templateDefaults';
import type { ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';

export const templatePresets = {
    Towing: ['hero', 'services', 'testimonial', 'cta'],
    Bakery: ['hero', 'image', 'quote', 'button'],
    Agency: ['hero', 'video', 'quote', 'grid'],
  } as const;
  
  export function createTemplateFromPresetWithBlocks(
    industry: keyof typeof templatePresets
  ): ValidatedTemplate {
    const name = generateUniqueTemplateName(industry);
    const slug = slugify(name);
    const blocks = templatePresets[industry].map(createDefaultBlock);
  
    return {
      ...templateDefaults, // ✅ moved first
      id: '',
      // name,
      slug,
      industry,
      layout: 'default',
    //   brand: '',
      data: {
        pages: [
          createDefaultPage({
            title: industry + ' Site',
            content_blocks: blocks,
          }),
        ],
      },
    };
  }
  
  
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

  return {
    id: '',
    // name,
    slug,
    // industry,
    // layout,
    // brand,
    ...templateDefaults,
    data: {
      pages: [
        createDefaultPage({
          title: 'Welcome',
          content_blocks: [
            createDefaultBlock('hero'),
            createDefaultBlock('services'),
            createDefaultBlock('testimonial'),
            createDefaultBlock('cta'),
          ],
        }),
      ],
    },
  };
}
