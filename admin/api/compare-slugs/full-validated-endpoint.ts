import { z } from 'zod';
import { withQueryValidation } from '../../../lib/api/withQueryValidation.js';
import { withInputOutputValidation } from '../../../lib/api/withInputOutputValidation.js';

const querySchema = z.object({
  mode: z.enum(['basic', 'extended']),
});

const bodySchema = z.object({
  values: z.array(z.string().min(1)),
});

const resultSchema = z.object({
  slugPairs: z.array(z.string()),
  summary: z.string(),
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

// Safe POST with full input/output validation using 'as any'
const handlePost = withInputOutputValidation(
  bodySchema as any,
  resultSchema as any,
  async (input: any, req: Request): Promise<any> => {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') || 'basic';

    const slugPairs = getPermutations(input.values);
    const summary =
      mode === 'extended'
        ? `Generated ${slugPairs.length} pairs using ${input.values.length} values.`
        : `${slugPairs.length} pairs`;

    return { slugPairs, summary };
  }
);

// Safe GET with query validation using 'as any'
const handleGet = withQueryValidation(querySchema as any, async (query: any) => {
  return Response.json({ info: `Mode is: ${query.mode}` });
});

export const GET = handleGet;
export const POST = handlePost;
export const runtime = 'edge';
