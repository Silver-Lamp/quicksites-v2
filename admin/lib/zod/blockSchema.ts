// admin/lib/zod/blockSchema.ts
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

// Lazy declaration to support recursion
export const BlockSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion('type', [
    TextBlockSchema,
    ImageBlockSchema,
    VideoBlockSchema,
    AudioBlockSchema,
    QuoteBlockSchema,
    ButtonBlockSchema,
    GridBlockSchema, // ← now safe to include recursively
  ])
);

export const GridBlockSchema = z.object({
  type: z.literal('grid'),
  value: z.object({
    columns: z.number().min(1).max(12),
    items: z.array(BlockSchema).max(4, 'Limit 4 blocks inside a grid'),
  }),
});
export type Block = z.infer<typeof BlockSchema>;
export type GridBlock = z.infer<typeof GridBlockSchema>;
export function isValidBlock(data: unknown): data is Block {
  const result = BlockSchema.safeParse(data);
  return result.success;
}
export const blockPreviewFallback: Record<Block['type'], string> = {
  text: '📝 Text Block',
  image: '🖼️ Image',
  video: '📹 Video',
  audio: '🎧 Audio',
  quote: '❝ Quote',
  button: '🔘 Button',
  grid: '📐 Grid Layout',
};
