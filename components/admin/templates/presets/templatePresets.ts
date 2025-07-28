import { generatePresetBlocks } from './generatePresetBlocks';
import type { TemplateData } from '@/types/template';

export const templatePresets = {
  pages: [
    {
      id: '1',
      slug: 'towing',
      title: 'Towing',
      content_blocks: generatePresetBlocks(['hero', 'services', 'testimonial', 'cta']),
    },
    {
      id: '2',
      slug: 'bakery',
      title: 'Bakery',
      content_blocks: generatePresetBlocks(['hero', 'image', 'quote', 'cta']),
    },
    {
      id: '3',
      slug: 'agency',
      title: 'Agency',
      content_blocks: generatePresetBlocks(['hero', 'video', 'quote', 'grid']),
    },
  ],
} as TemplateData;
