// lib/zod/blockSchema.ts
import { z } from 'zod';

export const TextBlockSchema = z.object({
  type: z.literal('text'),
  value: z.string(),
});

export const ImageBlockSchema = z.object({
  type: z.literal('image'),
  value: z.object({
    url: z.string().url(),
    alt: z.string(),
  }),
});

export const VideoBlockSchema = z.object({
  type: z.literal('video'),
  value: z.object({
    url: z.string().url(),
    caption: z.string().optional(),
  }),
});

export const AudioBlockSchema = z.object({
  type: z.literal('audio'),
  value: z.object({
    provider: z.enum(['spotify', 'soundcloud', 'suno']),
    url: z.string().url(),
    title: z.string().optional(),
  }),
});

export const QuoteBlockSchema = z.object({
  type: z.literal('quote'),
  value: z.object({
    text: z.string(),
    author: z.string().optional(),
  }),
});

export const ButtonBlockSchema = z.object({
  type: z.literal('button'),
  value: z.object({
    label: z.string(),
    href: z.string().url(),
    style: z.enum(['primary', 'secondary', 'ghost']).optional(),
  }),
});

// Note: this uses lazy for recursion
export const GridBlockSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.literal('grid'),
    value: z.object({
      columns: z.number().min(1).max(12),
      items: z.array(BlockSchema),
    }),
  })
);

export const BlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ImageBlockSchema,
  VideoBlockSchema,
  AudioBlockSchema,
  QuoteBlockSchema,
  ButtonBlockSchema,
  GridBlockSchema,
]);
