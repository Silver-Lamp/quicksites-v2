import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;

function deriveSlug(req: NextRequest, fallback = 'deliveredmenu') {
  const url = new URL(req.url);
  const q = url.searchParams.get('slug');
  if (q) return q;
  const explicit = req.headers.get('x-site-slug');
  if (explicit) return explicit;
  const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').toLowerCase();
  if (!host) return fallback;
  if (host.startsWith('delivered.menu')) return 'deliveredmenu';
  const sub = host.split(':')[0].split('.')[0];
  if (sub && sub !== 'www' && sub !== 'localhost') {
    return sub.replace(/[^a-z0-9-]/g, '').replace(/-/g, '');
  }
  return fallback;
}

async function siteIdBySlug(admin: AnyClient, slug: string) {
  const { data, error } = await (admin as any).from('sites').select('id').eq('slug', slug).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  // Safety: disable in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const onlyTest = url.searchParams.get('onlyTest') === '1';

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) as AnyClient;
  const slug = deriveSlug(req);
  const siteId = await siteIdBySlug(admin, slug);
  if (!siteId) return NextResponse.json({ meals: [] });

  const fields =
    'id,title,image_url,price_cents,qty_available,status,is_active,created_at,available_from,available_to,chef_id,merchant_id';

  let q = (admin as any)
    .from('meals')
    .select(fields)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (onlyTest) {
    // show drafts / not-active
    q = q.or('status.eq.draft,is_active.eq.false');
  } else {
    // published-only (mirrors public grid expectations)
    q = q.eq('status', 'published').eq('is_active', true);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ meals: data ?? [] });
}
