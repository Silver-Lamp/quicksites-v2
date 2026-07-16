// app/api/commerce/site-merchant/route.ts
//
// The store behind a site, for the editor's commerce blocks (products_grid et al).
// Fixes the old dead end where adding a products block demanded a merchant be picked
// in a modal the block editor can't reach — and where the product list rode an
// admin-only endpoint that 403'd for real site owners.
//
//   GET  ?templateId=  → the template's merchant (meta.ecom.merchant_id, falling back
//                        to the owner's merchant) + its products. Never creates.
//   POST { templateId } → "Set up my store": find-or-create the OWNER's merchant
//                        (ensureMerchantForOwner — same one-per-owner rule as the
//                        Shopify import + menu publish paths), stamp
//                        meta.ecom.merchant_id on the template through the sanctioned
//                        commit RPC (checkout wiring reads it), return it + products.
//
// Auth: requireTemplateOwner (owner or platform admin; guest OWNERS included — a
// guest can stage their store, but publishing/Stripe payouts still require signup).
import { NextRequest, NextResponse } from 'next/server';
import { requireTemplateOwner } from '@/lib/auth/requireTemplateOwner';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ensureMerchantForOwner } from '@/lib/commerce/shopifyCatalog';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProductLite = {
  id: string;
  title: string;
  price_cents: number;
  image_url: string | null;
  product_type: string | null;
};

function firstImage(images: any): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const f = images[0];
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') return f.url ?? f.src ?? null;
  return null;
}

async function listProducts(merchantId: string): Promise<ProductLite[]> {
  const { data } = await supabaseAdmin
    .from('catalog_items')
    .select('id, title, price_cents, images, type, status')
    .eq('merchant_id', merchantId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(200);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    price_cents: Number(r.price_cents || 0),
    image_url: firstImage(r.images),
    // canonical 'product' reads as 'physical' in the admin/editor vocabulary
    product_type: r.type === 'product' ? 'physical' : (r.type ?? null),
  }));
}

async function loadTemplate(templateId: string) {
  const { data } = await supabaseAdmin
    .from('templates')
    .select('id, owner_id, business_name, template_name, slug, data, rev')
    .eq('id', templateId)
    .maybeSingle();
  return data as any | null;
}

/** The merchant this template sells for: the meta stamp first, else the owner's. */
async function resolveMerchantId(tpl: any): Promise<string | null> {
  const stamped = tpl?.data?.meta?.ecom?.merchant_id ?? tpl?.data?.meta?.ecommerce?.merchant_id;
  if (typeof stamped === 'string' && stamped) return stamped;
  if (!tpl?.owner_id) return null;
  const { data } = await supabaseAdmin
    .from('merchants')
    .select('id')
    .eq('owner_id', tpl.owner_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as any)?.id ?? null;
}

export async function GET(req: NextRequest) {
  const templateId = new URL(req.url).searchParams.get('templateId') || '';
  if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });
  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;

  const tpl = await loadTemplate(templateId);
  if (!tpl) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

  const merchantId = await resolveMerchantId(tpl);
  return NextResponse.json({
    ok: true,
    merchantId,
    products: merchantId ? await listProducts(merchantId) : [],
  });
}

export async function POST(req: NextRequest) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  if (!templateId) return NextResponse.json({ error: 'templateId is required.' }, { status: 400 });
  const gate = await requireTemplateOwner(templateId);
  if (!gate.ok) return gate.response;

  const tpl = await loadTemplate(templateId);
  if (!tpl) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });

  // The store belongs to the TEMPLATE's owner (an admin acting on an outreach draft
  // creates it for the draft's owner, not for themselves).
  const ownerId = tpl.owner_id ?? gate.userId;
  const merchantId = await ensureMerchantForOwner(supabaseAdmin, {
    ownerId,
    businessName: tpl.business_name || tpl.template_name || 'My Store',
    siteSlug: tpl.slug || '',
  });

  // Stamp meta.ecom.merchant_id so the storefront/cart wiring and every future
  // editor session agree on the store. Best-effort — the merchant exists regardless.
  const currentStamp = tpl?.data?.meta?.ecom?.merchant_id;
  let stamped = currentStamp === merchantId;
  if (!stamped) {
    const nextData = {
      ...(tpl.data ?? {}),
      meta: {
        ...(tpl.data?.meta ?? {}),
        ecom: { ...(tpl.data?.meta?.ecom ?? {}), merchant_id: merchantId },
      },
    };
    const err = await commitTemplatePatch(templateId, tpl.rev ?? 0, { data: nextData }, gate.userId);
    stamped = !err;
  }

  return NextResponse.json({
    ok: true,
    merchantId,
    stamped,
    products: await listProducts(merchantId),
    catalogUrl: `/merchant/catalog?merchant=${encodeURIComponent(merchantId)}`,
  });
}
