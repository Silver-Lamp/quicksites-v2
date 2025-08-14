// app/api/chef/meals/update/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { slugify, RESERVED_SLUGS } from '@/lib/slug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Json = Record<string, any>;

export async function PATCH(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const body: Json = await req.json();
  const {
    mealId,
    title,
    description,
    price_cents,
    image_url,
    available_from,
    available_to,
    max_per_order,
    qty_available,
    is_active,
    cuisines,
    auto_deactivate_when_sold_out,
    slug: slugInput,
    hashtags,
    hashtags_mode,
  } = body || {};

  if (!mealId) {
    return NextResponse.json({ error: 'mealId required' }, { status: 400 });
  }

  // Merchant that belongs to current user
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!merchant) {
    return NextResponse.json({ error: 'No merchant for user' }, { status: 400 });
  }

  // Fetch current meal to verify ownership and get site_id (needed for slug uniqueness)
  const { data: currentMeal, error: currentErr } = await supabase
    .from('meals')
    .select('id, site_id, slug')
    .eq('id', mealId)
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  if (currentErr) {
    return NextResponse.json({ error: currentErr.message }, { status: 500 });
  }
  if (!currentMeal) {
    return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });
  }

  // Build update payload (only provided fields)
  const patch: Json = {};
  if (typeof title === 'string') patch.title = title;
  if (typeof description === 'string') patch.description = description;
  if (typeof image_url === 'string') patch.image_url = image_url;
  if (typeof is_active === 'boolean') patch.is_active = is_active;

  if (price_cents != null) {
    const n = Number(price_cents);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json(
        { error: 'price_cents must be a positive integer' },
        { status: 400 },
      );
    }
    patch.price_cents = n;
  }

  if (max_per_order != null) {
    const n = Number(max_per_order);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json(
        { error: 'max_per_order must be a positive integer' },
        { status: 400 },
      );
    }
    patch.max_per_order = n;
  }

  if (qty_available != null) {
    const n = Number(qty_available);
    if (!Number.isInteger(n) || n < 0) {
      return NextResponse.json(
        { error: 'qty_available must be a non-negative integer' },
        { status: 400 },
      );
    }
    patch.qty_available = n;
  }

  if (available_from != null) {
    patch.available_from = available_from ? new Date(available_from).toISOString() : null;
  }
  if (available_to != null) {
    patch.available_to = available_to ? new Date(available_to).toISOString() : null;
  }

  if (Array.isArray(cuisines)) {
    const clean = Array.from(
      new Set(
        cuisines
          .map((s: any) => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
          .filter(Boolean),
      ),
    ).slice(0, 5);
    patch.cuisines = clean;
  }

  if (typeof auto_deactivate_when_sold_out === 'boolean') {
    patch.auto_deactivate_when_sold_out = auto_deactivate_when_sold_out;
  }
  if (typeof hashtags === 'string') patch.hashtags = hashtags;
  if (hashtags_mode === 'replace' || hashtags_mode === 'append') {
    patch.hashtags_mode = hashtags_mode;
  }
  

  // ---- collision-safe slug handling (if slug provided) ----------------------
  // Accept: string -> set, null/'' -> clear, undefined -> ignore
  if (slugInput !== undefined) {
    if (slugInput === null || String(slugInput).trim() === '') {
      patch.slug = null; // allow clearing
    } else {
      const base = slugify(String(slugInput));
      if (!base) {
        return NextResponse.json({ error: 'Slug is empty after sanitization' }, { status: 400 });
      }
      const isReserved =
        (Array.isArray(RESERVED_SLUGS) && RESERVED_SLUGS.includes(base)) ||
        (RESERVED_SLUGS instanceof Set && RESERVED_SLUGS.has(base));
      if (isReserved) {
        return NextResponse.json({ error: 'Slug is reserved' }, { status: 400 });
      }

      // Fetch any slugs at this site that start with base (excluding this meal)
      const { data: siblings, error: siblingsErr } = await supabase
        .from('meals')
        .select('slug')
        .eq('site_id', currentMeal.site_id)
        .neq('id', mealId)
        .ilike('slug', `${base}%`);

      if (siblingsErr) {
        return NextResponse.json({ error: siblingsErr.message }, { status: 500 });
      }

      const used = new Set<string>((siblings || []).map((r) => r.slug).filter(Boolean));
      let candidate = base;
      let i = 2;

      const reservedHas = (s: string) =>
        (Array.isArray(RESERVED_SLUGS) && RESERVED_SLUGS.includes(s)) ||
        (RESERVED_SLUGS instanceof Set && RESERVED_SLUGS.has(s));

      while (used.has(candidate) || reservedHas(candidate)) {
        candidate = `${base}-${i++}`;
      }
      patch.slug = candidate;
    }
  }
  // --------------------------------------------------------------------------

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Perform update (ownership already verified)
  const { data, error } = await supabase
    .from('meals')
    .update(patch)
    .eq('id', mealId)
    .eq('merchant_id', merchant.id)
    .select('*')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 });

  // ---- restock notification enqueue (if now sellable) ----------------------
  const { data: fresh } = await supabase
    .from('meals')
    .select('id, title, qty_available, is_active, site_id')
    .eq('id', data.id)
    .single();

  const isBack = !!fresh && (Number(fresh.qty_available ?? 0) > 0) && !!fresh.is_active;

  if (isBack) {
    const { data: subs } = await supabase
      .from('waitlist_subscriptions')
      .select('id, email, token')
      .eq('meal_id', fresh.id)
      .eq('status', 'active');

    if (subs?.length) {
      const { restockTemplate } = await import('@/lib/email');
      const baseUrl = process.env.APP_BASE_URL || '';
      const mealUrl = `${baseUrl}/meals/${fresh.id}`;

      const rows = subs.map((s) => {
        const unsubscribeUrl = `${baseUrl}/unsubscribe?token=${s.token}`;
        return {
          subscription_id: s.id,
          meal_id: fresh.id,
          to_email: s.email,
          subject: `${fresh.title} is back in stock`,
          html: restockTemplate({
            mealTitle: fresh.title,
            mealUrl,
            unsubscribeUrl,
            siteName: 'delivered.menu',
          }),
          status: 'pending',
        };
      });

      await supabase.from('email_outbox').insert(rows);
      await supabase
        .from('waitlist_subscriptions')
        .update({ status: 'queued' })
        .eq('meal_id', fresh.id)
        .eq('status', 'active');
    }
  }
  // --------------------------------------------------------------------------

  return NextResponse.json({ ok: true, meal: data });
}
