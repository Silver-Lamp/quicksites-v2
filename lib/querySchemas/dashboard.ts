// lib/querySchemas/dashboard.ts
import { z } from 'zod';
import { defineRouteQuery } from '@/lib/defineRouteQuery';

export const {
  schema: dashboardQuerySchema,
  defaultParams: dashboardDefaults,
  useQuery: useDashboardQuery,
} = defineRouteQuery(
  z.object({
    tab: z.enum(['overview', 'settings', 'activity']).default('overview'),
    page: z.coerce.number().min(1).default(1),
    filter: z.string().optional(),
  })
);
