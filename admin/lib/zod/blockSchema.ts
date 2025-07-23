import { z } from 'zod';

// Shared link schema
const LinkSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  href: z.string().min(1, 'URL is required'),
});

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
    schema: z.object({
      label: z.string().min(1, 'CTA label is required'),
      link: z.string().min(1, 'CTA link is required'),
    }),
  },
  faq: {
    label: 'FAQ',
    icon: '❓',
    schema: z.object({
      title: z.string().min(1, 'FAQ title is required'),
      items: z.array(z.object({ question: z.string().min(1, 'Question is required'), answer: z.string().min(1, 'Answer is required') })).min(1, 'At least one FAQ item is required'),
    }),
  },
  testimonial: {
    label: 'Testimonial',
    icon: '💬',
    schema: z.object({
      testimonials: z.array(
        z.object({
          quote: z.string().min(1, 'Quote is required'),
          attribution: z.string().optional(),
          avatar_url: z.string().url().optional(),
          rating: z.number().min(1).max(5).optional(),
        })
      ).min(1, 'At least one testimonial is required'),
      randomized: z.boolean().optional(),
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
      image_url: z.union([z.string().url(), z.literal('')]).optional(),
      layout_mode: z.enum(['inline', 'background', 'full_bleed']).optional(),
      blur_amount: z.number().min(0).max(100).optional(),
      parallax_enabled: z.boolean().optional(),
      image_position: z.enum(['top', 'center', 'bottom']).optional(),
      image_x: z.number().min(0).max(100).optional(),
      image_y: z.number().min(0).max(100).optional(),
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
    icon: '🏠',
    schema: z.object({
      businessName: z.string(),
      address: z.string(),
      cityState: z.string(),
      phone: z.string(),
      links: z.array(LinkSchema),
      logo_url: z.string().optional(),
      social_links: z
        .array(z.object({ platform: z.string(), url: z.string() }))
        .optional(),
      copyright: z.string().optional(),
    }),
  },
  header: {
    label: 'Header',
    icon: '🏠',
    schema: z.object({
      logoUrl: z.string().optional(),
      navItems: z.array(LinkSchema),
    }),
  },
  service_areas: {
    label: 'Service Areas',
    icon: '🌍',
    schema: z.object({
      cities: z.array(z.string()).min(1, 'At least one city is required'),
    }),
  },
  contact_form: {
    label: 'Contact Form',
    icon: '📧',
    schema: z.object({
      title: z.string().min(1, 'Title is required'),
      notification_email: z.string().email('Invalid email address'),
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
      z.object({
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
