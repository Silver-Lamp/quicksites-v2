import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function generateUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 1;

  while (true) {
    const { data } = await supabase
      .from('sites')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!data) break;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }

  return slug;
}

export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumerics with dashes
    .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
    .replace(/--+/g, '-'); // collapse multiple dashes
}

export function generateBaseSlug(
  businessName: string,
  location?: string
): string {
  const name = toSlug(businessName);
  const loc = location ? toSlug(location.split(',')[0]) : '';
  return loc ? `${name}-${loc}` : name;
}
