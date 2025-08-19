// app/api/chef/meals/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/serverClient';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normHost = (s: string) =>
  s.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];

async function resolveSiteUUID(hint?: string): Promise<string | null> {
  if (!hint) return null;
  if (UUID_RE.test(hint)) return hint;

  // Service-role for cross-table lookups (no RLS issues)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const host = normHost(hint);

  // 1) sites table (id/slug/domain)
  const s1 = await admin
    .from('sites')
    .select('id')
    .or(`slug.eq.${hint},domain.eq.${host}`)
    .maybeSingle();
  if (s1.data?.id) return s1.data.id;

  // 2) templates fallback (since you sometimes store sites there)
  const s2 = await admin
    .from('templates')
    .select('site_id, host, slug')
    .or(`slug.eq.${hint},host.eq.${host}`)
    .maybeSingle();
  if (s2.data?.site_id) return s2.data.site_id;

  return null;
}

export async function GET(req: NextRequest) {
  const supabase = await getServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const url = new URL(req.url);
  // Accept either ?siteId=<uuid> or ?site=<slug/host/uuid>
  const siteHint = url.searchParams.get('siteId') || url.searchParams.get('site') || undefined;
  const siteUUID = await resolveSiteUUID(siteHint);

  // owner rows
  const [{ data: merchant }, { data: chef }] = await Promise.all([
    supabase.from('merchants').select('id').eq('user_id', user.id).maybeSingle(),
    supabase.from('chefs').select('id').eq('user_id', user.id).maybeSingle(),
  ]);

  let q = supabase
    .from('meals')
    .select(
      'id, title, slug, price_cents, is_active, qty_available, max_per_order, created_at, site_id, cuisines, auto_deactivate_when_sold_out, status, is_test'
    )
    .order('created_at', { ascending: false })
    .limit(50);

  // Filter by ownership
  if (merchant?.id && chef?.id) {
    q = q.or(`merchant_id.eq.${merchant.id},chef_id.eq.${chef.id}`);
  } else if (merchant?.id) {
    q = q.eq('merchant_id', merchant.id);
  } else if (chef?.id) {
    q = q.eq('chef_id', chef.id);
  } else {
    return NextResponse.json({ meals: [] });
  }

  // Apply site filter only when we have a UUID
  if (siteUUID) q = q.eq('site_id', siteUUID);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meals: data ?? [] });
}
