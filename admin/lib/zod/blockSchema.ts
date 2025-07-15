import { z } from 'zod';

// Step 1: Define content schema map w/ UI metadata
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
    schema: z
      .object({
        label: z.string().min(1, 'CTA label is required'),
        link: z.string().min(1, 'CTA link is required'),
      })
      .strict(),
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
    schema: z
      .object({
        headline: z.string().min(1, 'Headline is required'),
        subheadline: z.string().optional(),
        cta_text: z.string().optional(),
        cta_link: z.string().optional(),
        image_url: z.union([z.string().url(), z.literal('')]).optional(),
        show_image_as_bg: z.boolean().optional(),
      })
      .strict(),
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
      business_name: z.string().min(1, 'Business name is required'),
      address: z.string().min(1, 'Address is required'),
      city_state: z.string().min(1, 'City/State is required'),
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

// Step 2: Build base block schemas with shared fields
export function createBlockUnion<
  T extends Record<string, { label: string; icon: string; schema: z.ZodTypeAny }>
>(map: T) {
  const schemas: z.ZodDiscriminatedUnionOption<'type'>[] = [];
  const meta: Record<keyof T, { label: string; icon: string }> = {} as any;

  for (const [type, config] of Object.entries(map)) {
    schemas.push(
      z
        .object({
          type: z.literal(type),
          content: config.schema,
          _id: z.string().optional(),
          tone: z.string().optional(),
          industry: z.string().optional(),
          tags: z.array(z.string()).optional(),
          meta: z.record(z.any()).optional(),
        }) as z.ZodDiscriminatedUnionOption<'type'>
    );
    meta[type as keyof T] = {
      label: config.label,
      icon: config.icon,
    };
  }

  return { schemas, meta };
}

const { schemas: BasicBlockSchemas, meta: blockMeta } = createBlockUnion(blockContentSchemaMap);

// Step 3: Final block schema (with grid + recursion)
export const BlockSchema: z.ZodTypeAny = z.lazy(() => {
  const GridBlockSchema: z.ZodDiscriminatedUnionOption<'type'> = z.object({
    type: z.literal('grid'),
    content: z.object({
      columns: z.number().min(1).max(12),
      items: z.array(BlockSchema),
    }),
    _id: z.string().optional(),
    tone: z.string().optional(),
    industry: z.string().optional(),
    tags: z.array(z.string()).optional(),
    meta: z.record(z.any()).optional(),
  }) as z.ZodDiscriminatedUnionOption<'type'>;

  return z.discriminatedUnion('type', [
    ...BasicBlockSchemas as unknown as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]],
    GridBlockSchema,
  ]);
});

// Step 4: Export helpers and types
export const BlocksArraySchema = z.array(BlockSchema);
export type Block = z.infer<typeof BlockSchema>;

export function isValidBlock(data: unknown): data is Block {
  return BlockSchema.safeParse(data).success;
}

export function migrateLegacyBlock(block: any): any {
  if ('content' in block) return block;
  if ('value' in block) return { ...block, content: block.value };
  return block;
}

export const blockPreviewFallback: Record<Block['type'], string> = Object.entries(
  blockMeta as Record<Block['type'], { label: string; icon: string }>
).reduce((acc, [key, val]) => {
  acc[key as Block['type']] = `${val.icon} ${val.label}`;
  return acc;
}, {} as Record<Block['type'], string>);

export { blockMeta };
