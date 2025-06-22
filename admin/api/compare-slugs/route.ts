import { z } from 'zod';
import { withInputOutputValidation } from '../../../lib/api/withInputOutputValidation.js';
import { withQueryValidation } from '../../../lib/api/withQueryValidation.js';

const SlugsSchema = z.object({
  slugs: z.array(z.string()),
});

const PostInputSchema = z.object({
  values: z.array(z.string().min(1)),
});

const QuerySchema = z.object({
  mode: z.enum(['basic', 'extended']),
});

function getPermutations(values: string[]): string[] {
  const results: string[] = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      results.push(`${values[i]}-vs-${values[j]}`);
    }
  }
  return results;
}

async function getSlugs(): Promise<{ slugs: string[] }> {
  return { slugs: ['alpha-vs-beta', 'gamma-vs-delta'] };
}

// GET with cast to prevent TS deep type instantiation
const handleGet = withQueryValidation(QuerySchema as any, async (query: any): Promise<any> => {
  const result = await getSlugs();
  const parsed = SlugsSchema.safeParse(result);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid output format' }, { status: 500 });
  }
  return Response.json(parsed.data);
});

// POST with full input/output validation and cast
const handlePost = withInputOutputValidation(
  PostInputSchema as any,
  SlugsSchema as any,
  async (input: any): Promise<any> => {
    const slugs = getPermutations(input.values);
    return { slugs };
  }
);

export const GET = handleGet;
export const POST = handlePost;
export const runtime = 'experimental-edge';
