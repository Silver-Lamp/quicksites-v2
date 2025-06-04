// utils/zodToJsonSchema.ts
import { z } from 'zod';
import { zodToJsonSchema as converter } from 'zod-to-json-schema';

export function zodToJsonSchema(schema: z.ZodTypeAny): object {
  return converter(schema);
}
