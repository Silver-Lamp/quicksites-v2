// lib/defaultSchema.ts
import { z } from 'zod';

export const defaultSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(0).optional(),
  subscribe: z.boolean().default(false),
});
