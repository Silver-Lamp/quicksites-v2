export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import slugify from 'slugify';
import { customAlphabet } from 'nanoid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

async function ensureUniqueSlug(base: string) {
  let candidate = base;
  let attempt = 1;

  while (true) {
    const { data: existing } = await supabase
      .from('support_campaigns')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!existing) return candidate;
    candidate = `${base}-${nanoid()}`;
    attempt++;
    if (attempt > 5) throw new Error('Failed to generate unique slug');
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const { slug, headline, goal_count, target_action, block_id } = await req.json();

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseSlug = slug
    ? slugify(slug, { lower: true, strict: true })
    : slugify(headline || 'campaign', { lower: true, strict: true });

  let finalSlug: string;

  try {
    finalSlug = await ensureUniqueSlug(baseSlug);
  } catch (err: any) {
    return Response.json({ error: err.message || 'Slug generation failed' }, { status: 500 });
  }

  const { error } = await supabase.from('support_campaigns').insert({
    slug: finalSlug,
    headline,
    goal_count,
    target_action,
    block_id,
    created_by: user.id,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, slug: finalSlug });
}
