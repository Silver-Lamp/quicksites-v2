// app/api/sites/[id]/route.ts
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextRequest } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop()?.toLowerCase() || '';

  if (!id) {
    return json({ error: 'Missing or invalid site identifier' }, { status: 400 });
  }

  const isUUID = /^[0-9a-fA-F-]{36}$/.test(id);
  const isSlugLike = /^[a-z0-9-]+$/.test(id);

  const possibleDomains = isSlugLike ? [id, id.replace(/-/g, '.') + '.com'] : [];

  const tryFields: { field: string; value: string }[] = [{ field: 'vanity_url', value: id }];

  if (isUUID) {
    tryFields.push({ field: 'id', value: id });
  } else {
    tryFields.push(
      ...possibleDomains.map((v) => ({ field: 'domain', value: v })),
      { field: 'slug', value: id },
      { field: 'business_name', value: id }
    );
  }

  let data = null;
  let error = null;

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
    return json({ error: 'Site not found' }, { status: 404 });
  }

  return json({
    ...data.content,
    _meta: {
      id: data.id,
      slug: data.slug || (data.domain?.replace('.com', '').replace(/\./g, '-') ?? null),
      domain: data.domain ?? null,
    },
  });
}
