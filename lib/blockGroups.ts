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
    types: ['text', 'quote', 'faq', 'testimonial', 'video', 'audio'],
  },
  layout: {
    label: 'Layout',
    types: ['grid', 'footer', 'header'],
  },
  callToAction: {
    label: 'Calls to Action',
    types: ['hero', 'cta', 'contact_form', 'button'],
  },
  services: {
    label: 'Business Features',
    types: ['services'],
  },
};
