// app/api/create-campaign/route.ts
// Use createCampaign() when you need to create a campaign
// Use getUserFromRequest() when you need the user context

export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import slugify from 'slugify';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

// Create Supabase client inside the handler to avoid edge leakage
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function ensureUniqueSlug(base: string, supabase: ReturnType<typeof getSupabaseClient>) {
  let candidate = base;
  let attempt = 1;

  while (attempt <= 5) {
    const { data } = await supabase
      .from('support_campaigns')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) return candidate;
    candidate = `${base}-${nanoid()}`;
    attempt++;
  }

  throw new Error('Failed to generate unique slug after multiple attempts');
}

export async function POST(req: NextRequest): Promise<Response> {
  const supabase = getSupabaseClient();

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return Response.json({ error: 'Missing auth token' }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { slug, headline, goal_count, target_action, block_id } = body;

  const baseSlug = slug
    ? slugify(slug, { lower: true, strict: true })
    : slugify(headline || 'campaign', { lower: true, strict: true });

  let finalSlug: string;
  try {
    finalSlug = await ensureUniqueSlug(baseSlug, supabase);
  } catch (err: any) {
    return Response.json({ error: err.message || 'Slug generation failed' }, { status: 500 });
  }

  const { error: insertError } = await supabase.from('support_campaigns').insert({
    slug: finalSlug,
    headline,
    goal_count,
    target_action,
    block_id,
    created_by: user.id,
  });

  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ success: true, slug: finalSlug });
}
