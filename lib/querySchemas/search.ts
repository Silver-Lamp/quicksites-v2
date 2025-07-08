// lib/querySchemas/search.ts
import { z } from 'zod';
import { defineRouteQuery } from '@/lib/defineRouteQuery';

export const {
  schema: searchQuerySchema,
  useQuery: useSearchQuery,
  stringify: stringifySearchParams,
  getStaticParams: getStaticSearchParams,
  defaultParams: searchDefaults,
} = defineRouteQuery(
  z.object({
    q: z.string().default(''),
    sort: z.enum(['relevance', 'newest']).default('relevance'),
    page: z.coerce.number().min(1).default(1),
    tags: z
      .string()
      .optional()
      .transform((v) => v?.split(',') || []),
  })
);
