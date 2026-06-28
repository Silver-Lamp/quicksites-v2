// app/api/electinfo/unlock-request/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getActiveSiteId } from '@/lib/sites/context';

export async function POST(req: NextRequest) {
  // Read body ONCE
  const body = (await req.json().catch(() => ({}))) as any;
  const { feature, from_email, from_phone, message, site_id, slug } = body ?? {};

  // Prefer explicit site_id, else fall back to headers/host/referer/slug
  const siteId = site_id ?? (await getActiveSiteId(req, { slug }));
  if (!siteId) return NextResponse.json({ error: 'no site' }, { status: 400 });

  const supabase = await getServerSupabase();
  // table/col not in live DB — cast to any (was failing silently); see types migration
  const { error } = await (supabase as any).from('unlock_requests').insert({
    site_id: siteId,
    feature_code: feature,
    from_email: from_email ?? null,
    from_phone: from_phone ?? null,
    message: message ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // TODO: notify campaign owner (email/SMS/Slack)
  return NextResponse.json({ ok: true });
}
