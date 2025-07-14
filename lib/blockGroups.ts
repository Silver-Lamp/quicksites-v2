import type { Block } from '@/types/blocks';

export const blockGroups: Record<
  string,
  {
    label: string;
    types: Block['type'][];
  }
> = {
  content: {
    label: 'Content Blocks',
    types: ['text', 'quote', 'testimonial', 'video', 'audio'],
  },
  layout: {
    label: 'Layout',
    types: ['grid', 'footer'],
  },
  callToAction: {
    label: 'Calls to Action',
    types: ['hero', 'cta', 'button'],
  },
  services: {
    label: 'Business Features',
    types: ['services'],
  },
};
