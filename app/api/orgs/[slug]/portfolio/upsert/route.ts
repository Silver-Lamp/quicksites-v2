// app/api/orgs/[slug]/portfolio/upsert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function normalizeSlug(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Create a server Supabase client following your working patterns.
async function getSupabaseServerClient() {
  // In your setup, cookies() is awaitable
  const cookieStore = await cookies();

  // Minimal cookie adapter: only `get` (like your working examples)
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
      // You used this in another working route; keep it consistent
      cookieEncoding: 'base64url' as const,
    } as any
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const supabase = await getSupabaseServerClient();

  // Parse JSON body
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Resolve org_id from org slug in the route
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 400 });
  }
  if (!org) {
    return NextResponse.json({ error: 'Org not found' }, { status: 404 });
  }

  // Natural key for portfolio item is (org_id, slug)
  const itemSlug = normalizeSlug(body?.slug ?? body?.payload?.slug);
  if (!itemSlug) {
    return NextResponse.json({ error: 'Missing or invalid item slug' }, { status: 400 });
  }

  const payload = (body?.payload ?? {}) as Record<string, unknown>;

  // Upsert via RPC we created earlier (upsert_feature_portfolio_by_slug)
  const { data, error } = await supabase.rpc('upsert_feature_portfolio_by_slug', {
    p_org_id: org.id,
    p_slug: itemSlug,
    p_payload: payload,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data });
}
