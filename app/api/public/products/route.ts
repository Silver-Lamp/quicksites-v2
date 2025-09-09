// app/api/public/products/route.ts
import { NextResponse } from 'next/server';
import { createClient, PostgrestError } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ── env & client ── */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}
const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_ROLE = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ── helpers ── */
const missingRelation = (e?: PostgrestError) =>
  e?.code === '42P01' || /relation .* does not exist/i.test(e?.message || '');

function parseIds(sp: URLSearchParams): string[] {
  // supports ?ids=a,b,c  and  ?ids=a&ids=b
  const groups = sp.getAll('ids');
  const one = sp.get('id'); // optional: ?id=abc
  const raw = [...groups, one ?? ''].filter(Boolean);
  const out = new Set<string>();
  for (const r of raw) r.split(',').forEach((x) => x && out.add(x.trim()));
  return Array.from(out).slice(0, 100);
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

// resolve merchantId from email if needed
async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data: prof } = await db.from('profiles').select('user_id').ilike('email', email).maybeSingle();
  if (prof?.user_id) return prof.user_id as string;
  const { data: authUser } = await db.from('auth.users' as any).select('id').ilike('email', email).maybeSingle();
  return (authUser?.id as string) ?? null;
}
async function getMerchantIdByEmail(email: string): Promise<string | null> {
  const { data: m1 } = await db.from('merchants').select('id').ilike('email', email).maybeSingle();
  if (m1?.id) return m1.id as string;
  const uid = await getUserIdByEmail(email);
  if (!uid) return null;
  const { data: m2 } = await db.from('merchants').select('id').eq('user_id', uid).maybeSingle();
  return (m2?.id as string) ?? null;
}

/* ── GET /api/public/products ──
   - ids=... (uuids or slugs)
   - OR merchantId=... | email=...  (+ limit)
*/
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ids = parseIds(url.searchParams);

    const email = (url.searchParams.get('email') || '').trim();
    const merchantIdParam = (url.searchParams.get('merchantId') || '').trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '24', 10) || 24, 1), 100);

    const selectCols = 'id,slug,title,price_cents,image_url,product_type,qty_available';
    const results: any[] = [];

    // Path A: explicit IDs (keeps current behavior)
    if (ids.length) {
      const uuids = ids.filter(isUuid);
      const slugs = ids.filter((x) => !isUuid(x));

      if (uuids.length) {
        const { data, error } = await db.from('products').select(selectCols).in('id', uuids);
        if (error && !missingRelation(error)) return NextResponse.json({ error: error.message }, { status: 500 });
        if (Array.isArray(data)) results.push(...data);
      }
      if (slugs.length) {
        const { data, error } = await db.from('products').select(selectCols).in('slug', slugs);
        if (error && !missingRelation(error)) return NextResponse.json({ error: error.message }, { status: 500 });
        if (Array.isArray(data)) results.push(...data);
      }

      // de-dup by id
      const byId = new Map<string, any>();
      for (const p of results) {
        const id = String(p?.id || '');
        if (id && !byId.has(id)) byId.set(id, p);
      }
      return NextResponse.json({ products: Array.from(byId.values()) }, { status: 200 });
    }

    // Path B: no IDs → fetch by merchant
    let merchantId: string | null = null;
    if (merchantIdParam) merchantId = merchantIdParam;
    else if (email) merchantId = await getMerchantIdByEmail(email);

    if (!merchantId) {
      // soft behavior for rendering: empty list instead of 400
      return NextResponse.json({ products: [], hint: 'no-merchant' }, { status: 200 });
    }

    const { data, error } = await db
      .from('products')
      .select(selectCols)
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (missingRelation(error)) return NextResponse.json({ products: [] }, { status: 200 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ products: [], hint: e?.message || 'server error' }, { status: 200 });
  }
}
