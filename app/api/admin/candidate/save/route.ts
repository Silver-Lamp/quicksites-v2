// app/api/admin/candidate/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const { slug, blocks, flags } = body || {};
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

  // Accept either an array of blocks OR { blocks: [...] }
  let toStore: any = blocks;
  if (Array.isArray(blocks)) {
    toStore = { blocks };
  } else if (blocks && typeof blocks === 'object' && Array.isArray(blocks.blocks)) {
    toStore = blocks;
  } else if (blocks == null) {
    // no blocks change
  } else {
    return NextResponse.json({ error: 'blocks must be an array or { blocks: [...] }' }, { status: 400 });
  }

  const patch: Record<string, any> = {};
  if (toStore !== undefined) {
    patch.blocks = JSON.stringify(toStore);
  }
  if (flags && typeof flags === 'object') {
    for (const k of [
      'is_paid',
      'allow_text',
      'allow_email',
      'enable_donations',
      'enable_events',
      'enable_newsletter',
      'enable_endorsements',
      'enable_volunteer',
    ]) {
      if (k in flags) patch[k] = !!flags[k];
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const supabase = await getServerSupabase({ serviceRole: true });
  const { error } = await supabase.from('candidate_pages').update(patch as any).eq('slug', slug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
