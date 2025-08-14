import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { siteId, title, description, price_cents, image_url, available_from, available_to, max_per_order, qty_available, cuisines, auto_deactivate_when_sold_out, slug:slugInput, hashtags, hashtags_mode } = await req.json();

  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: merchant } = await supabase.from('merchants').select('id').eq('user_id', user.id).single();
  if (!merchant) return NextResponse.json({ error: 'No merchant' }, { status: 400 });

  // Optional: verify this merchant is attached to the site
  const { data: link } = await supabase.from('site_merchants').select('status').eq('site_id', siteId).eq('merchant_id', merchant.id).maybeSingle();
  if (!link || link.status !== 'approved') return NextResponse.json({ error: 'Not approved for this site' }, { status: 403 });

   // Normalize cuisines
   const cleanCuisines: string[] | null = Array.isArray(cuisines)
   ? Array.from(new Set(
       cuisines
         .map((s: any) => typeof s === 'string' ? s.trim().toLowerCase() : '')
         .filter(Boolean)
     )).slice(0, 5) // max 5 tags
   : null;

  // Build a unique slug per site
  let base = slugify(slugInput || title || 'meal');
  if (RESERVED_SLUGS.has(base)) base = `${base}-meal`;

  // Ensure uniqueness by adding -2/-3 suffix if needed
  let finalSlug = base;
  for (let i = 2; i < 100; i++) {
    const { data: clash } = await supabase
      .from('meals')
      .select('id')
      .eq('site_id', siteId)
      .eq('slug', finalSlug)
      .maybeSingle();
    if (!clash) break;
    finalSlug = `${base}-${i}`;
  }

  const ins = await supabase.from('meals').insert({
    site_id: siteId,
    merchant_id: merchant.id,
    title,
    description: description ?? '',
    price_cents,
    image_url,
    available_from,
    available_to,
    max_per_order: max_per_order ?? 5,
    qty_available,
    cuisines: cleanCuisines,
    hashtags: typeof hashtags === 'string' ? hashtags : null,
    hashtags_mode: hashtags_mode === 'replace' ? 'replace' : 'append',
    auto_deactivate_when_sold_out: typeof auto_deactivate_when_sold_out === 'boolean'
      ? auto_deactivate_when_sold_out : true,
    slug: finalSlug                                  // ← NEW
  }).select('id, slug').single();

  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  return NextResponse.json({ ok: true, mealId: ins.data!.id, slug: ins.data!.slug });
}
