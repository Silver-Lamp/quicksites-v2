import { z } from 'zod';

const SlugsSchema = z.object({
  slugs: z.array(z.string()),
});

export async function fetchSlugsGET(): Promise<string[]> {
  const res = await fetch('/api/compare-slugs');
  const data = await res.json();

  const parsed = SlugsSchema.safeParse(data);
  if (!parsed.success) throw new Error('Invalid response format from GET');
  return parsed.data.slugs;
}

export async function fetchSlugsPOST(values: string[]): Promise<string[]> {
  const res = await fetch('/api/compare-slugs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });

  const data = await res.json();
  const parsed = SlugsSchema.safeParse(data);
  if (!parsed.success) throw new Error('Invalid response format from POST');
  return parsed.data.slugs;
}
