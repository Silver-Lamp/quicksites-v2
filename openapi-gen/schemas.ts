// openapi-gen/schemas.ts
import { z } from 'zod';

export const UserInput = z.object({
  email: z.string().email(),
  name: z.string(),
});

export const UserResponse = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string().datetime(),
});
