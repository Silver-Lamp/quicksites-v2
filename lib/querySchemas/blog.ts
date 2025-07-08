// lib/querySchemas/blog.ts
import { z } from 'zod';
import { defineRouteQuery } from '@/lib/defineRouteQuery';

export const {
  schema: blogQuerySchema,
  useQuery: useBlogQuery,
  stringify: stringifyBlogParams,
  getStaticParams: getStaticBlogParams,
  defaultParams: blogDefaults,
} = defineRouteQuery(
  z.object({
    category: z.enum(['ai', 'design', 'code']).default('ai'),
    tag: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
  })
);
