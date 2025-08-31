import { supabaseAdmin } from './clients';

/** Make a subdomain slug unique by suffixing (-2, -3, …). */
export async function ensureUniqueSubdomain(base: string): Promise<string> {
  const root = (base || 'demo')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '') || 'demo';

  let candidate = root;
  let i = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseAdmin
      .from('sites')
      .select('id')
      .eq('slug', candidate)
      .limit(1);

    if (error) throw new Error(error.message);
    if (!data?.length) return candidate;

    candidate = `${root}-${i++}`;
  }
}

/** Upsert a site row by (slug) and return id/slug. Adjust columns if needed. */
export async function upsertSite(opts: {
  merchantId: string;
  templateId: string;
  slug: string;
  customDomain?: string | null;
  published?: boolean;
  data?: any;
}) {
  const row = {
    merchant_id: opts.merchantId,
    template_id: opts.templateId,
    slug: opts.slug,
    custom_domain: opts.customDomain ?? null,
    published: !!opts.published,
    data: opts.data ?? null,
  };

  const up = await supabaseAdmin
    .from('sites')
    .upsert(row, { onConflict: 'slug' })
    .select('id, slug')
    .single();

  if (up.error) throw new Error(up.error.message);
  return up.data as { id: string; slug: string };
}
