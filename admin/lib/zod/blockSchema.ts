import { z } from 'zod';

// Step 1: Define per-block content schemas with metadata
export const blockContentSchemaMap = {
  text: {
    label: 'Text Block',
    icon: '📝',
    schema: z.object({ value: z.string() }),
  },
  image: {
    label: 'Image',
    icon: '🖼️',
    schema: z.object({
      url: z.string().url(),
      alt: z.string(),
    }),
  },
  video: {
    label: 'Video',
    icon: '📹',
    schema: z.object({
      url: z.string().url(),
      caption: z.string().optional(),
    }),
  },
  audio: {
    label: 'Audio',
    icon: '🎧',
    schema: z.object({
      provider: z.enum(['spotify', 'soundcloud', 'suno']),
      url: z.string().url(),
      title: z.string().optional(),
    }),
  },
  quote: {
    label: 'Quote',
    icon: '❝',
    schema: z.object({
      text: z.string(),
      author: z.string().optional(),
    }),
  },
  button: {
    label: 'Button',
    icon: '🔘',
    schema: z.object({
      label: z.string(),
      href: z.string().url(),
      style: z.enum(['primary', 'secondary', 'ghost']).optional(),
    }),
  },
  hero: {
    label: 'Hero',
    icon: '🎯',
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      cta_label: z.string().optional(),
      cta_link: z.string().optional(),
    }),
  },
  services: {
    label: 'Services',
    icon: '🧰',
    schema: z.object({
      items: z.array(z.string()),
    }),
  },
  testimonial: {
    label: 'Testimonial',
    icon: '💬',
    schema: z.object({
      quote: z.string(),
      attribution: z.string().optional(),
    }),
  },
  cta: {
    label: 'Call to Action',
    icon: '🚀',
    schema: z.object({
      label: z.string(),
      link: z.string().url(),
    }),
  },
} as const;

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
        value: config.schema,
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

export const BlockSchema: z.ZodType<any> = z.discriminatedUnion('type', BasicBlockSchemas as [z.ZodDiscriminatedUnionOption<'type'>, ...z.ZodDiscriminatedUnionOption<'type'>[]]);

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
