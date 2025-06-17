/* app/api/compare-slugs/route.ts */

import { z, ZodSchema } from 'zod';
import {
  badRequest,
  internalError,
  withValidation,
} from '../../../lib/api/json.js';

const SlugsSchema = z.object({
  slugs: z.array(z.string()),
});

async function getSlugs(): Promise<{ slugs: string[] }> {
  // Simulated payload — or real fetch logic here
  const slugs = ['alpha-vs-beta', 'gamma-vs-delta'];
  return { slugs };
}

export const GET = withValidation(getSlugs, SlugsSchema);
export const runtime = 'edge';

function getPermutations(values: string[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      pairs.push(`${values[i]}-vs-${values[j]}`);
    }
  }
  return pairs;
}
export function withInput<T>(
  schema: ZodSchema<T>,
  handler: (input: T, req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const result = schema.safeParse(body);
      if (!result.success) {
        return badRequest('Invalid input', result.error.format());
      }
      return handler(result.data, req);
    } catch (err: any) {
      return internalError(err.message || 'Failed to parse request body');
    }
  };
}
