import { z } from 'zod';

// Step 1: Define per-block content schemas with metadata
export const blockContentSchemaMap = {
  text: {
    label: 'Text Block',
    icon: '📝',
    schema: z.object({
      value: z.string().min(1, 'Text content is required'),
    }),
  },
  quote: {
    label: 'Quote',
    icon: '❝',
    schema: z.object({
      text: z.string().min(1, 'Quote text is required'),
      attribution: z.string().optional(),
    }),
  },
  button: {
    label: 'Button',
    icon: '🔘',
    schema: z.object({
      label: z.string().min(1, 'Button label is required'),
      href: z.string().url('Link must be a valid URL'),
      style: z.enum(['primary', 'secondary', 'ghost']).optional(),
    }),
  },
  cta: {
    label: 'Call to Action',
    icon: '🚀',
    schema: z.object({
      label: z.string().min(1, 'CTA label is required'),
      link: z.string().min(1, 'CTA link is required'),
    }),
  },
  testimonial: {
    label: 'Testimonial',
    icon: '💬',
    schema: z.object({
      quote: z.string().min(1, 'Quote is required'),
      attribution: z.string().optional(),
    }),
  },
  hero: {
    label: 'Hero',
    icon: '🎯',
    schema: z.object({
      headline: z.string().min(1, 'Headline is required'),
      subheadline: z.string().optional(),
      cta_text: z.string().optional(),
      cta_link: z.string().optional(),
      image_url: z.string().url('Image must be a valid URL').optional(),
    }),
  },
  services: {
    label: 'Services',
    icon: '🧰',
    schema: z.object({
      items: z.array(z.string()).min(1, 'At least one service is required'),
    }),
  },
  audio: {
    label: 'Audio',
    icon: '🎧',
    schema: z.object({
      provider: z.enum(['spotify', 'soundcloud', 'suno']),
      url: z.string().url('Audio URL must be valid'),
      title: z.string().optional(),
    }),
  },
  video: {
    label: 'Video',
    icon: '📹',
    schema: z.object({
      url: z.string().url('Video URL must be valid'),
      caption: z.string().optional(),
    }),
  },
  footer: {
    label: 'Footer',
    icon: '📞',
    schema: z.object({
      businessName: z.string().min(1, 'Business name is required'),
      address: z.string().min(1, 'Address is required'),
      cityState: z.string().min(1, 'City/State is required'),
      phone: z.string().min(1, 'Phone number is required'),
      links: z
        .array(
          z.object({
            label: z.string().min(1, 'Link label is required'),
            href: z.string().url('Link must be a valid URL'),
          })
        )
        .min(1, 'At least one link is required'),
    }),
  },
};

// Step 2: Factory function to generate block union + UI metadata
export function createBlockUnion<
  T extends Record<string, { label: string; icon: string; schema: z.ZodTypeAny }>
>(
  map: T
): {
  schemas: z.ZodDiscriminatedUnionOption<'type'>[];
  meta: Record<keyof T, { label: string; icon: string }>;
} {
  const schemas: z.ZodDiscriminatedUnionOption<'type'>[] = [];
  const meta: Partial<Record<keyof T, { label: string; icon: string }>> = {};

  for (const [type, config] of Object.entries(map)) {
    schemas.push(
      z.object({
        type: z.literal(type),
        content: config.schema,
      }) as z.ZodDiscriminatedUnionOption<'type'>
    );

    meta[type as keyof T] = {
      label: config.label,
      icon: config.icon,
    };
  }

  return { schemas, meta } as {
    schemas: z.ZodDiscriminatedUnionOption<'type'>[];
    meta: Record<keyof T, { label: string; icon: string }>;
  };
}

// Step 3: Create base schemas + grid + final union
const { schemas: BasicBlockSchemas, meta: blockMeta } = createBlockUnion(blockContentSchemaMap);

export const BlockSchema: z.ZodType<any> = z.discriminatedUnion(
  'type',
  BasicBlockSchemas as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]]
);

export const GridBlockSchema = z.object({
  type: z.literal('grid'),
  value: z.object({
    columns: z.number().min(1).max(12),
    items: z.lazy(() => z.array(BlockSchema).max(4, 'Limit 4 blocks inside a grid')),
  }),
});

// Step 4: Export schema, helpers, and types
export type Block = z.infer<typeof BlockSchema>;
export type GridBlock = z.infer<typeof GridBlockSchema>;

export function isValidBlock(data: unknown): data is Block {
  return BlockSchema.safeParse(data).success;
}

export const blockPreviewFallback: Record<Block['type'], string> = Object.entries(blockMeta).reduce(
  (acc, [key, val]) => {
    acc[key as Block['type']] = val.icon + ' ' + val.label;
    return acc;
  },
  {} as Record<Block['type'], string>
);

export { blockMeta };
