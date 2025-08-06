import { z } from 'zod';

export function defineBlock<
  T extends {
    type: string;
    content: Record<string, any>;
    meta: {
      label: string;
      icon?: string;
      description?: string;
    };
  }
>(config: T) {
  const schema = z.object({
    type: z.literal(config.type),
    _id: z.string(),
    meta: z.any().optional(),
    tags: z.array(z.string()).optional(),
    tone: z.string().optional(),
    industry: z.string().optional(),
    content: z.object(config.content),
  });

  return {
    schema,
    meta: config.meta,
  };
}
