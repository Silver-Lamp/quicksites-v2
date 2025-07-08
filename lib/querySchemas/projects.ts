// lib/querySchemas/projects.ts
import { z } from 'zod';
import { defineRouteQuery } from '@/lib/defineRouteQuery';

export const {
  schema: projectQuerySchema,
  useQuery: useProjectQuery,
  stringify: stringifyProjectParams,
  getStaticParams: getStaticProjectParams,
  defaultParams: projectDefaults,
} = defineRouteQuery(
  z.object({
    status: z.enum(['active', 'archived', 'all']).default('active'),
    team: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
  })
);
