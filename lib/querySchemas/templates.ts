// lib/querySchemas/templates.ts
import { z } from 'zod';
import { defineRouteQuery } from '@/lib/defineRouteQuery';

export const {
  schema: templatesQuerySchema,
  useQuery: useTemplatesQuery,
  stringify: stringifyTemplatesParams,
} = defineRouteQuery(
  z.object({
    industry: z.string().optional(),
    date: z.enum(['All time', 'Last 7 days', 'This month']).optional(),
  })
);
