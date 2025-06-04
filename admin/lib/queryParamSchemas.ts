// lib/queryParamSchemas.ts
import { z } from 'zod';

export const queryParamSchemas: Record<string, z.ZodSchema> = {
  campaign: z.object({
    source: z.string(),
    medium: z.string(),
    audience: z.enum(['cold', 'warm', 'hot']),
    budget: z.number().optional(),
  }),
  email: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  site: z.object({
    domain: z.string(),
    region: z.string().optional(),
    features: z.array(z.string()).optional(),
  }),
};
