import { z } from 'zod';

export const blockContentSchemaMap = {
  hero: {
    label: 'Hero',
    icon: '🎯',
    schema: z.object({
      headline: z.string().min(1, 'Headline is required'),
      subheadline: z.string().optional(),
      cta_text: z.string().optional(),
      cta_link: z.string().optional(),
      image_url: z.string().url().optional(),
    }),
  }
  // other blocks...
};
