// app/api/orgs/[slug]/portfolio/upsert/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

function normalizeSlug(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')   // replace spaces/special chars with dash
    .replace(/-+/g, '-')           // collapse multiple dashes
    .replace(/^-|-$/g, '');        // trim ends
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const orgSlug = normalizeSlug(slug);

  // anon server client (cookie-only get; same pattern you use elsewhere)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
      cookieEncoding: 'base64url' as const,
    } as any
  );

  // 🔁 IMPORTANT: read from organizations_public (RLS-friendly), not organizations
  const { data: org, error: orgErr } = await supabase
    .from('organizations_public')
    .select('id, slug')
    .eq('slug', orgSlug)
    .maybeSingle();

  if (orgErr) {
    return NextResponse.json({ error: orgErr.message }, { status: 400 });
  }
  if (!org) {
    return NextResponse.json({ error: `Org not found for slug "${orgSlug}"` }, { status: 404 });
  }

  // parse body
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const itemSlug = normalizeSlug(body?.slug ?? body?.payload?.slug);
  if (!itemSlug) {
    return NextResponse.json({ error: 'Missing or invalid portfolio item slug' }, { status: 400 });
  }

  const payload = (body?.payload ?? {}) as Record<string, unknown>;

  // Upsert via your SECURITY DEFINER RPC
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
