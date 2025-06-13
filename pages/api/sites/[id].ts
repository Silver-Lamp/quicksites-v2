import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const raw = req.query.id;

  if (typeof raw !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid site identifier' });
  }

  const id = raw.toLowerCase();
  let data = null;
  let error = null;

  const isUUID = /^[0-9a-fA-F-]{36}$/.test(id);
  const isSlugLike = /^[a-z0-9-]+$/.test(id);

  // If it looks like a slug, try also converting to domain
  const possibleDomains = isSlugLike ? [id, id.replace(/-/g, '.') + '.com'] : [];

  const tryFields: { field: string; value: string }[] = [];

  // priority to vanity_url
  tryFields.unshift({ field: 'vanity_url', value: id });

  if (isUUID) {
    tryFields.push({ field: 'id', value: id });
  } else {
    tryFields.push(
      ...possibleDomains.map((v) => ({ field: 'domain', value: v })),
      { field: 'slug', value: id },
      { field: 'business_name', value: raw } // preserve casing for names
    );
  }

  for (const { field, value } of tryFields) {
    const result = await supabase
      .from('sites')
      .select('*')
      .eq(field, value)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (result.data) {
      data = result.data;
      break;
    }
    error = result.error;
  }

  if (!data) {
    console.error(`Site not found for "${id}":`, error?.message);
    return res.status(404).json({ error: 'Site not found' });
  }

  return res.status(200).json({
    ...data.content,
    _meta: {
      id: data.id,
      slug: data.slug || (data.domain?.replace('.com', '').replace(/\./g, '-') ?? null),
      domain: data.domain ?? null,
    },
  });
  
}
