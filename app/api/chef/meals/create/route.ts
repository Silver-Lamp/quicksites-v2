// app/api/chef/meals/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ----------------------------- helpers --------------------------------------

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeHost = (hint: string) =>
  hint.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[:/].*$/, '')
    .replace(/^www\./, '');

function isMissingRelation(err?: { message?: string }) {
  return /relation .* does not exist/i.test(String(err?.message || ''));
}

function isColumnMissing(err?: { message?: string }, table?: string, col?: string) {
  const m = String(err?.message || '');
  if (table && col) {
    return new RegExp(
      `column\\s+"?${col}"?\\s+of\\s+relation\\s+"?${table}"?\\s+does\\s+not\\s+exist`,
      'i'
    ).test(m);
  }
  return /does not exist/i.test(m);
}

/**
 * Resolve a site UUID from UUID | slug | hostname across:
 * - sites.slug / sites.hostname
 * - site_hosts.host
 * - templates.(slug|handle|site_slug|hostname|domain|host)
 *
 * Uses the SERVICE ROLE key only for this read, then all writes
 * happen with the RLS-enforced user client.
 */
async function resolveSiteIdAdmin(hintRaw: string): Promise<string | null> {
  const hint = (hintRaw || '').trim();
  if (!hint) return null;

  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!adminUrl || !serviceKey) return null;

  const admin = createAdminClient(adminUrl, serviceKey);

  // UUID straight through (verify if possible)
  if (UUID.test(hint)) {
    try {
      const { data } = await admin.from('sites').select('id').eq('id', hint).maybeSingle();
      return data?.id ?? hint; // accept as-is if sites table isn't present
    } catch {
      return hint;
    }
  }

  const host = normalizeHost(hint);
  const noDots = host.replace(/\./g, '');

  const tryOnce = async (table: string, col: string, val: string | null) => {
    if (!val) return null;
    try {
      // 👇 break Supabase's deep generic inference for dynamic table access
      const a: any = admin;
      // request only what we need; if a column doesn't exist, this will throw and we'll swallow it
      const { data }: { data: { id?: string; site_id?: string } | null } = await a
        .from(table)
        .select('id, site_id')
        .eq(col, val)
        .maybeSingle();
  
      if (!data) return null;
      return data.id ?? data.site_id ?? null;
    } catch {
      // table/column not present or other read errors → treat as "not found"
      return null;
    }
  };

  // sites / site_hosts
  const fromSites =
    (await tryOnce('sites', 'slug', hint)) ||
    (await tryOnce('sites', 'slug', host)) ||
    (await tryOnce('sites', 'slug', noDots)) ||
    (await tryOnce('sites', 'hostname', host)) ||
    (await tryOnce('site_hosts', 'host', host));

  if (fromSites) return fromSites;

  // templates (your current single-source-of-truth)
  const fromTemplates =
    (await tryOnce('templates', 'slug', hint)) ||
    (await tryOnce('templates', 'slug', host)) ||
    (await tryOnce('templates', 'handle', hint)) ||
    (await tryOnce('templates', 'site_slug', hint)) ||
    (await tryOnce('templates', 'hostname', host)) ||
    (await tryOnce('templates', 'domain', host)) ||
    (await tryOnce('templates', 'host', host));

  return fromTemplates ?? null;
}

// ------------------------------- route --------------------------------------

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    siteId,
    title,
    description,
    price_cents,
    image_url,
    available_from,
    available_to,
    max_per_order,
    qty_available,
    cuisines,
    auto_deactivate_when_sold_out,
    slug: slugInput,
    hashtags,
    hashtags_mode,
    status,        // 'draft' | 'published' | 'archived' (optional)
    is_test,       // bypass approval when true (and mark the row if column exists)
  } = body || {};

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  if (!title)  return NextResponse.json({ error: 'title required' }, { status: 400 });
  if (!(Number.isInteger(price_cents) && price_cents > 0)) {
    return NextResponse.json({ error: 'price_cents must be a positive integer' }, { status: 400 });
  }

  // Resolve the site UUID from UUID | slug | hostname (supports templates)
  const site_id = await resolveSiteIdAdmin(siteId);
  if (!site_id) {
    return NextResponse.json({ error: 'Unknown site. Enter a valid site UUID or slug.' }, { status: 400 });
  }

  // Authenticated user client (RLS enforced)
  const jar = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieEncoding: 'base64url',
      cookies: {
        getAll: () => jar.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cks) => cks.forEach((c) => jar.set(c.name, c.value, c.options as CookieOptions | undefined)),
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const userId = auth.user.id;

  // Merchant
  const { data: merchant, error: merchErr } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (merchErr) return NextResponse.json({ error: merchErr.message }, { status: 500 });
  if (!merchant?.id) return NextResponse.json({ error: 'No merchant for user' }, { status: 400 });
  const merchant_id = merchant.id;

  // Optional approval gate: allow test (dev or is_test), and tolerate missing table
  const devMode = process.env.NODE_ENV !== 'production';
  const wantTest = Boolean(is_test) || devMode;

  let approved = false;
  const { data: link, error: linkErr } = await supabase
    .from('site_merchants')
    .select('status')
    .eq('site_id', site_id)
    .eq('merchant_id', merchant_id)
    .maybeSingle();

  if (linkErr) {
    if (!isMissingRelation(linkErr)) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
    // If the relation/table doesn't exist in this project, don't block.
    approved = true;
  } else {
    approved = link?.status === 'approved';
  }
  if (!approved && !wantTest) {
    return NextResponse.json({ error: 'Not approved for this site' }, { status: 403 });
  }

  // Chef row for RLS ownership (meals.chef_id must belong to auth.uid())
  const { data: chef, error: chefErr } = await supabase
    .from('chefs')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (chefErr) return NextResponse.json({ error: chefErr.message }, { status: 500 });
  if (!chef?.id) {
    return NextResponse.json(
      { error: 'Chef profile not found. Please complete your profile first.' },
      { status: 409 }
    );
  }
  const chef_id = chef.id;

  // Normalize cuisines (max 5)
  const cleanCuisines: string[] | null = Array.isArray(cuisines)
    ? Array.from(new Set(
        cuisines
          .map((s: any) => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
          .filter(Boolean)
      )).slice(0, 5)
    : null;

  // Unique slug per site
  let base = slugify(slugInput || title || 'meal');
  if (RESERVED_SLUGS.has(base)) base = `${base}-meal`;

  let finalSlug = base;
  for (let i = 2; i < 100; i++) {
    const { data: clash, error: clashErr } = await supabase
      .from('meals')
      .select('id')
      .eq('site_id', site_id)
      .eq('slug', finalSlug)
      .maybeSingle();
    if (clashErr) break;     // DB will enforce a unique index if you have one
    if (!clash) break;
    finalSlug = `${base}-${i}`;
  }

  // Compose payload that satisfies RLS
  const payload: Record<string, any> = {
    site_id,
    merchant_id,
    chef_id,
    title,
    description: description ?? '',
    price_cents,
    image_url: image_url ?? null,
    available_from: available_from ?? null,
    available_to: available_to ?? null,
    max_per_order: max_per_order ?? 5,
    qty_available: qty_available ?? null,
    cuisines: cleanCuisines,
    hashtags: typeof hashtags === 'string' ? hashtags : null,
    hashtags_mode: hashtags_mode === 'replace' ? 'replace' : 'append',
    auto_deactivate_when_sold_out:
      typeof auto_deactivate_when_sold_out === 'boolean' ? auto_deactivate_when_sold_out : true,
    slug: finalSlug,
    status: (status === 'published' || status === 'archived' ? status : 'draft') as
      | 'draft'
      | 'published'
      | 'archived',
  };

  // Flag test content when possible (column may not exist in older schemas)
  if (wantTest) payload.is_test = true;

  const tryInsert = async (p: Record<string, any>) =>
    supabase.from('meals').insert(p).select('id, slug').single();

  let ins = await tryInsert(payload);
  if (ins.error && isColumnMissing(ins.error, 'meals', 'is_test')) {
    const { is_test: _omit, ...noTest } = payload;
    ins = await tryInsert(noTest);
  }
  if (ins.error) {
    return NextResponse.json({ error: ins.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mealId: ins.data!.id,
    slug: ins.data!.slug,
    test: Boolean(payload.is_test),
    status: payload.status,
    site_id, // resolved UUID (helps debugging)
  });
}
