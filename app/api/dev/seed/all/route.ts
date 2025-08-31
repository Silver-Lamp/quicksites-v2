// app/api/dev/seed/all/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { T_MERCHANTS, T_PRODUCTS, T_TEMPLATES } from '../_lib/env';

// If table doesn't exist, PostgREST returns "relation ... does not exist"
const RELATION_MISSING =
  /relation .* does not exist|could not find the '.*' column|does not exist/i;

function isMissingTable(err: any) {
  const s = `${err?.message || ''} ${err?.details || ''}`.toLowerCase();
  return RELATION_MISSING.test(s);
}

// Safe wrappers that return {skipped:true} instead of throwing on missing table
async function safeDelete(table: string, filters: (q: any) => any) {
  const q = filters(supabaseAdmin.from(table));
  const { error } = await q;
  if (error) {
    if (isMissingTable(error)) return { skipped: true, error };
    return { error };
  }
  return { ok: true };
}

async function safeUpsert(table: string, rows: any[] | any, onConflict?: string) {
  const arr = Array.isArray(rows) ? rows : [rows];
  const q = supabaseAdmin
    .from(table)
    .upsert(arr, onConflict ? { onConflict } : undefined)
    .select('id');
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return { skipped: true, error };
    return { error };
  }
  return { ok: true, data };
}

async function safeUpdate(table: string, patch: any, filters: (q: any) => any) {
  const q = filters(supabaseAdmin.from(table).update(patch));
  const { error } = await q;
  if (error) {
    if (isMissingTable(error)) return { skipped: true, error };
    return { error };
  }
  return { ok: true };
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyClient = SupabaseClient<any, any, any>;
type SeedMode = 'merchant_products' | 'chef_meals' | 'both';

function envOrThrow(k: string) {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
}

/* =============================== Config =============================== */
const SUPABASE_URL = envOrThrow('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = envOrThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE_ROLE = envOrThrow('SUPABASE_SERVICE_ROLE_KEY');
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'site-images';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function getCookieBoundClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieEncoding: 'base64url',
    cookies: {
      getAll: () =>
        store.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cks) =>
        cks.forEach((c) =>
          store.set(c.name, c.value, c.options as CookieOptions | undefined)
        ),
    },
  }) as AnyClient;
}

/* ============================ Industry Hints ============================ */
const INDUSTRY_HINTS: Record<string, string> = {
  'Towing':
    'Emphasize 24/7 dispatch, rapid ETA, roadside assistance (lockouts, jumpstarts), transparent pricing.',
  'Window Washing':
    'Residential & commercial streak-free results, safety, water-fed poles, maintenance plans.',
  'Window Cleaning':
    'Residential & commercial streak-free results, safety, water-fed poles, maintenance plans.',
  'Roof Cleaning':
    'Soft-wash, moss/algae removal, protect shingles, before/after proof, warranties.',
  'Landscaping':
    'Seasonal maintenance, design/build, irrigation, hardscapes, curb appeal, HOA packages.',
  HVAC:
    'Emergency service, maintenance plans, SEER ratings, financing, heat pump expertise, indoor air quality.',
  Plumbing:
    'Emergency leaks, water heaters, drain clearing, camera inspection, upfront estimates.',
  Electrical:
    'Licensed, panel upgrades, EV chargers, lighting design, safety inspections, permits handled.',
  'Auto Repair':
    'Diagnostics, preventative maintenance, warranties, OEM parts, rideshare/loaner support.',
  'Carpet Cleaning':
    'Pet/odor treatment, fast-dry times, eco-friendly solutions, bundled room pricing.',
  Moving: 'Local/long-distance, packing/unpacking, insured, flat-rate options, careful handling.',
  'Pest Control':
    'Eco-aware treatments, quarterly plans, rodent exclusion, same-day service.',
  Painting:
    'Prep, color consult, clean job sites, interior/exterior, fast turnaround, warranties.',
  'General Contractor':
    'Licensed/bonded, permits, schedules, change-order transparency, portfolio credibility.',
  'Real Estate':
    'Neighborhood expertise, staging/photography, negotiation strength, transparent fees.',
  Restaurant:
    'Signature dishes, local sourcing, dietary options, delivery/pickup, lunch/dinner promos.',
  'Salon & Spa':
    'Experience/luxe vibe, memberships/packages, hygiene, before/after gallery.',
  Fitness: 'Programs, coaching, community, intro specials, class packs, transformation stories.',
  Photography:
    'Style specialties, packages, rights/usage, fast delivery, portfolio highlights.',
  Legal:
    'Practice focus, plain-language guidance, consults, discretion, outcome orientation.',
  'Medical / Dental':
    'Patient comfort, modern tech, insurance handling, preventative plans, trust & hygiene.',
  'Pressure Washing':
    'Driveways/siding/decks, safe pressures, restoration effect, curb appeal before/after.',
  'Junk Removal':
    'Same-day hauling, volume-based pricing, recycling/donation focus, property cleanouts.',
  // Retail / crafts / resell
  'Retail - Boutique':
    'Curated apparel & accessories, limited drops, styling, gift bundles, loyalty & lookbooks.',
  'Retail - Home Goods':
    'Quality & durability, room-by-room curation, bundles, warranties, easy returns.',
  'Retail - Electronics':
    'Specs clarity, warranties, trade-in, certified refurbished, accessories, bundles.',
  'Retail - Thrift/Resale':
    'Sustainable bargains, rotating inventory, condition grading, treasure-hunt vibe.',
  Crafts:
    'Handmade quality, custom orders, local sourcing, portfolio/gallery, social presence.',
  Handmade:
    'Artisan story, small batches, customization, care instructions, gift packaging.',
  'Etsy-style Shop':
    'SEOed listings, variants, personalization prompts, shipping/timeframes, reviews.',
  'Gifts & Stationery':
    'Occasion bundles, personalization, gift wrap, turnaround times.',
  'Artisan Goods':
    'Materials, craftsmanship, provenance, limited runs, authenticity.',
  'Art Supplies & Crafts':
    'Project kits, classes/workshops, repeatables, seasonal campaigns.',
  'Antiques & Vintage':
    'Era/provenance, condition notes, authenticity, care, limited one-offs.',
  Collectibles:
    'Rarity, grading, authenticity, protective cases, series/sets.',
  'Pet Boutique':
    'Sizing guides, safe materials, breed-specific picks, bundles, subscriptions.',
  'Pop-up Shop': 'Dates/locations, limited runs, preorders, QR to follow/social.',
  'Farmers Market Vendor':
    'Local sourcing, seasonal availability, freshness/ingredients, tastings.',
  'Online Reseller':
    'Sourcing transparency, quality grading, returns, bundle deals, shipping speeds.',
  'Print-on-Demand':
    'Design previews, size charts, fabric/finish options, production times.',
  'Custom Apparel':
    'Size charts, materials, care, design proofs, minimums, turnaround windows.',
};

function buildIndustryPrompt(
  industry?: string,
  base?: string,
  productType?: 'meal' | 'physical' | 'digital' | 'service' | 'mixed'
): string | undefined {
  const ind = (industry || '').trim();
  const hint = INDUSTRY_HINTS[ind] || '';
  if (!ind && !base) return undefined;

  const typeLine =
    ind === 'Restaurant' || productType === 'meal'
      ? 'Product focus: meals, sides, desserts, and bundles.'
      : 'Product focus: clear service packages, physical goods, and value tiers as appropriate.';

  const pieces = [
    ind ? `Industry: ${ind}.` : '',
    hint,
    typeLine,
    (base || '').trim(),
    'Keep copy concise, conversion-oriented, and SEO-friendly for local search.',
  ].filter(Boolean);

  return pieces.join(' ');
}

/* ============================== OpenAI =============================== */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function ideateBrandAndProducts(params: {
  aiPrompt?: string;
  count: number;
  productType: 'meal' | 'physical' | 'digital' | 'service' | 'mixed';
  seed?: string;
  industry?: string;
}) {
  const { aiPrompt, count, productType, seed, industry } = params;

  const sys = `You are a concise brand + product ideation engine for a local merchant marketplace.
Return JSON ONLY with keys { "brand": {...}, "products": [...] }.
Keep copy tight, marketable, and price outputs in USD dollars (not cents).`;

  const industryHint = industry ? (INDUSTRY_HINTS[industry] ?? '') : '';
  const typeNudge =
    productType === 'meal'
      ? 'Focus on restaurant-like menu items, sides, desserts, and bundles.'
      : productType === 'mixed'
      ? 'Return a diverse mix of physical/digital/service offers appropriate to the industry.'
      : `Focus primarily on ${productType} offers appropriate to the industry.`;

  const sysGuard = [
    industry ? `Industry: ${industry}.` : '',
    industryHint,
    typeNudge,
    'Prefer conversion-oriented copy tuned for local search (SEO).',
  ]
    .filter(Boolean)
    .join(' ');

  const user = {
    prompt: aiPrompt ?? 'Neighborhood artisan brand; friendly, trustworthy, quality-first.',
    count,
    productType,
    seed,
    schema: {
      brand: {
        name: 'string',
        tagline: 'string',
        about: 'string',
        city: 'string',
        state: 'string',
      },
      products: [
        {
          title: 'string',
          blurb: 'string',
          type: 'meal | physical | digital | service',
          price_usd: 'number (e.g., 14.99)',
          image_prompt: 'short visual description for a product photo',
        },
      ],
    },
  };

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    messages: [
      { role: 'system', content: sys },
      { role: 'system', content: sysGuard },
      { role: 'user', content: JSON.stringify(user) },
    ],
    // response_format: { type: 'json_object' }, // << ensure JSON
  });

  const json = JSON.parse(completion.choices[0]?.message?.content || '{}');
  const products = Array.isArray(json.products) ? json.products.slice(0, count) : [];
  const brand = json.brand || {};

  for (const p of products) {
    if (!p.type || p.type === 'mixed') p.type = productType === 'mixed' ? 'physical' : productType;
    const n = Number(p.price_usd);
    p.price_usd = Number.isFinite(n) && n > 0 ? n : 19;
  }
  return { brand, products };
}

/* ======================= Storage / Preview Image Helpers ======================== */
async function generateAndUploadPNG(params: {
  prompt: string;
  size: '256x256' | '512x512' | '1024x1024';
  path: string;
}): Promise<string | null> {
  const { prompt, size, path } = params;
  try {
    const gen = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size,
      // response_format: 'b64_json', // << needed for uploads
    });
    const b64 = gen.data?.[0]?.b64_json;
    if (!b64) return null;

    const buffer = Buffer.from(b64, 'base64');

    const { error: upErr } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (upErr) throw upErr;

    const { data: pub } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);
    return pub?.publicUrl || null;
  } catch (e) {
    console.error('[seed] image generate/upload failed:', e);
    return null;
  }
}

/** Upload a data URL (PNG) to Storage and return the public URL. */
async function uploadDataUrlPNG(dataUrl: string, path: string): Promise<string | null> {
  try {
    const [, b64] = dataUrl.split(',');
    if (!b64) return null;
    const buffer = Buffer.from(b64, 'base64');
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (error) throw error;
    const { data } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.error('[seed] uploadDataUrlPNG error:', e);
    return null;
  }
}

/** Generates an image as a data URL (PNG) without uploading. Default size: 1024. */
async function generateDataUrlPNG(
  prompt: string,
  size: '256x256' | '512x512' | '1024x1024' = '1024x1024'
): Promise<string | null> {
  const gen = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size,
    // response_format: 'b64_json', // << needed for previews
  });
  const b64 = gen.data?.[0]?.b64_json;
  return b64 ? `data:image/png;base64,${b64}` : null;
}

function slugify(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

async function ensureUniqueBatchSlugs(
  titles: string[],
  exists: Set<string>
): Promise<string[]> {
  const slugs: string[] = [];
  const used = new Set<string>(exists);
  for (const t of titles) {
    let base = slugify(t) || 'item';
    let candidate = base;
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${base}-${i++}`;
    }
    used.add(candidate);
    slugs.push(candidate);
  }
  return slugs;
}

/* ============================== Auth Gate =========================== */
async function assertAdmin() {
  const supa = await getCookieBoundClient();
  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return { ok: false as const, status: 401, error: 'Not signed in' };

  const { data: admin } = await supa
    .from('admin_users')
    .select('user_id')
    .eq('user_id', auth.user.id)
    .limit(1);

  if (!admin?.[0]) return { ok: false as const, status: 403, error: 'Forbidden' };
  return { ok: true as const, supa, adminUserId: auth.user.id };
}

/* ====================== Auth User Create/Find ======================= */
async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const u = (data.users || []).find(
      (x) => x.email?.toLowerCase() === email.toLowerCase()
    );
    if (u) return u;
    if ((data.users || []).length < 200) break;
  }
  return null;
}

async function createSeedUser(email: string, name: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw new Error(error.message);
  return data.user!;
}

/* ========================= DB Ensure Helpers ======================== */
async function ensureMerchantForUser(db: AnyClient, userId: string, name: string) {
  {
    const { data, error } = await db
      .from(T_MERCHANTS) // << fix: use var, not string literal
      .select('id, name, display_name')
      .eq('user_id', userId)
      .limit(1);
    if (!error && data?.[0]?.id) return data[0].id as string;
    if (error && !/does not exist|could not find the/i.test(`${error.message} ${error.details ?? ''}`)) {
      throw new Error(error.message);
    }
  }
  const payload = { id: randomUUID(), user_id: userId, name, display_name: name };
  const { error: ins } = await db.from(T_MERCHANTS).insert(payload);
  if (ins && !/duplicate key value/i.test(ins.message)) throw new Error(ins.message);
  const { data: again, error: err2 } = await db
    .from(T_MERCHANTS)
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (err2) throw new Error(err2.message);
  return again?.[0]?.id as string;
}

async function ensureChefForUser(
  db: AnyClient,
  userId: string,
  merchantId: string,
  name: string
) {
  {
    const { data, error } = await db
      .from('chefs')
      .select('id, merchant_id')
      .eq('user_id', userId)
      .limit(1);
    if (!error && data?.[0]?.id) {
      const chefId = data[0].id as string;
      if (data[0].merchant_id !== merchantId) {
        await db.from('chefs').update({ merchant_id: merchantId }).eq('id', chefId);
      }
      return chefId;
    }
    if (error && !/does not exist|could not find the/i.test(`${error.message} ${error.details ?? ''}`)) {
      throw new Error(error.message);
    }
  }
  const payload = { id: randomUUID(), user_id: userId, merchant_id: merchantId, name };
  const { error: ins } = await db.from('chefs').insert(payload);
  if (ins && !/duplicate key value/i.test(ins.message)) throw new Error(ins.message);
  const { data: again, error: err2 } = await db
    .from('chefs')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (err2) throw new Error(err2.message);
  return again?.[0]?.id as string;
}

/* ============================ Body Types ============================ */
type Body = {
  seed?: string;
  dryRun?: boolean;
  seedMode?: SeedMode;
  aiPrompt?: string;
  industry?: string;

  // legacy profile + meals
  profileOverwrite?: boolean;
  avatar?: boolean;
  avatarStyle?: 'photo' | 'illustration';
  avatarSize?: '256x256' | '512x512' | '1024x1024';
  mealsCount?: number;
  mealsGenerateImages?: boolean;
  mealsImageStyle?: 'photo' | 'illustration';
  mealsImageSize?: '256x256' | '512x512' | '1024x1024';
  mealsClearExisting?: boolean;

  // merchant + products
  merchantOverwrite?: boolean;
  merchantAvatar?: boolean;
  merchantAvatarStyle?: 'photo' | 'illustration';
  merchantAvatarSize?: '256x256' | '512x512' | '1024x1024';
  productsCount?: number;
  productsProductType?: 'meal' | 'physical' | 'digital' | 'service' | 'mixed';
  productsGenerateImages?: boolean;
  productsImageStyle?: 'photo' | 'illustration';
  productsImageSize?: '256x256' | '512x512' | '1024x1024';
  productsClearExisting?: boolean;

  // carry-over from PREVIEW so SAVE doesn't regenerate
  previewBrand?: any | null;
  previewLogoDataUrl?: string | null;
  previewItems?: Array<{
    title?: string;
    type?: string;
    price_usd?: number;
    blurb?: string | null;
    slug?: string | null;
    image_url?: string | null;
    image_data_url?: string | null;
  }>;

  targetEmail?: string;
};

/* =============================== Main =============================== */
export async function POST(req: NextRequest) {
  try {
    const gate = await assertAdmin();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body: Body = await req.json();
    const seedMode: SeedMode = body.seedMode ?? 'merchant_products';
    const isDry = !!body.dryRun;
    const seedTag = slugify(body.seed || '') || Math.random().toString(36).slice(2, 10);

    // Target auth user (create only when NOT dry)
    const targetEmail = (body.targetEmail || `seed+${seedTag}@demo.local`).toLowerCase();
    let authUser = await findAuthUserByEmail(targetEmail);
    if (!authUser) {
      authUser = isDry
        ? ({ id: randomUUID(), email: targetEmail, user_metadata: { name: 'Seed Merchant' } } as any)
        : await createSeedUser(targetEmail, 'Seed Merchant');
    }
    const userId: string = authUser!.id;

    // Ensure merchant/chef (skip DB access when dry)
    const merchantNameBase =
      'Seed ' + ((body.aiPrompt || '').split(/\W+/)?.[0] || 'Merchant');
    const merchantId: string = isDry
      ? randomUUID()
      : await ensureMerchantForUser(supabaseAdmin as any, userId, merchantNameBase);

    let chefId: string | null = null;
    if (!isDry && seedMode !== 'merchant_products') {
      chefId = await ensureChefForUser(
        supabaseAdmin as any,
        userId,
        merchantId,
        merchantNameBase.replace(/^Seed\s+/, 'Chef ')
      );
    }

    // If SAVE is carrying a preview payload, reuse it verbatim; otherwise (preview) generate fresh
    let brand: any;
    let products: any[];

    if (!isDry && Array.isArray(body.previewItems) && body.previewItems.length) {
      brand = body.previewBrand ?? null;
      products = body.previewItems.map((p) => ({ ...p })); // shallow copy
    } else {
      const effectivePrompt = buildIndustryPrompt(
        body.industry,
        body.aiPrompt,
        body.productsProductType ?? 'meal'
      );
      const count = Math.max(
        1,
        Math.min(48, Number(body.productsCount ?? body.mealsCount ?? 8))
      );
      const productType = body.productsProductType ?? 'meal';

      const ideated = await ideateBrandAndProducts({
        aiPrompt: effectivePrompt,
        count,
        productType,
        seed: seedTag,
        industry: body.industry,
      });
      brand = ideated.brand;
      products = ideated.products;
    }

    /* ================= Images: preview (data-URL) vs persisted (Storage) ================= */
    let logoUrl: string | null = null;
    let logoDataUrl: string | null = null;

    if (body.merchantAvatar) {
      if (!isDry && body.previewLogoDataUrl) {
        const path = `seed/${seedTag}/logo_${Date.now()}.png`;
        logoUrl = await uploadDataUrlPNG(body.previewLogoDataUrl, path);
      } else if (isDry) {
        const logoPrompt = `Logo for ${brand?.name || merchantNameBase}, ${
          body.merchantAvatarStyle === 'illustration'
            ? 'flat vector logo, clean, simple, high contrast'
            : 'professional brand photo logo, minimal'
        }. Minimal, legible.`;
        logoDataUrl = await generateDataUrlPNG(
          logoPrompt,
          body.merchantAvatarSize || '1024x1024'
        );
      }
    }

    if (body.productsGenerateImages) {
      for (const p of products) {
        if (!isDry && p.image_data_url) {
          const path = `seed/${seedTag}/products/${slugify(p.title || 'item')}_${Math.random()
            .toString(36)
            .slice(2, 7)}.png`;
          p.image_url = await uploadDataUrlPNG(p.image_data_url, path);
          delete p.image_data_url;
        } else if (isDry) {
          const base = p.image_prompt || `${p.type} product display, studio lighting`;
          const style =
            body.productsImageStyle === 'illustration' ? 'vector illustration' : 'photo';
          const prompt = `${base}; ${style}; ${
            brand?.name ? `brand: ${brand.name}` : ''
          }${body.industry ? `; industry: ${body.industry}` : ''}`;
          p.image_data_url = await generateDataUrlPNG(
            prompt,
            body.productsImageSize || '1024x1024'
          );
          p.image_url = null;
        }
      }
    } else {
      for (const p of products) {
        p.image_url = null;
        if (isDry) delete p.image_data_url;
      }
    }

    /* ================= Writes (skip on preview) =================== */
    const result: any = { ok: true, mode: isDry ? 'preview' : 'saved' };

    // Merchant patch (resilient to optional logo_url)
    if (seedMode !== 'chef_meals') {
      if (isDry) {
        result.merchant = {
          ok: true,
          preview: {
            merchant_id: merchantId,
            brand,
            logo_url: logoUrl,
            logo_data_url: logoDataUrl,
          },
        };
      } else {
        if (body.merchantOverwrite) {
          const basePatch: any = {
            name: brand?.name || merchantNameBase,
            display_name: brand?.name || merchantNameBase,
          };
          // try with logo_url first
          const withLogo = logoUrl ? { ...basePatch, logo_url: logoUrl } : basePatch;
          let up = await safeUpdate(T_MERCHANTS, withLogo, (q) => q.eq('id', merchantId));
          if (up.error && /logo_url/.test(`${up.error.message} ${up.error.details ?? ''}`)) {
            // retry without logo_url if column missing
            up = await safeUpdate(T_MERCHANTS, basePatch, (q) => q.eq('id', merchantId));
          }
          if (up.error && !up.skipped) {
            return NextResponse.json(
              { error: up.error.message, details: up.error.details },
              { status: 500 }
            );
          }
        }
        result.merchant = {
          ok: true,
          merchant_id: merchantId,
          name: brand?.name || merchantNameBase,
          logo_url: logoUrl ?? null,
        };
      }
    }

    // Clear existing products (only on save)
    if (!isDry && seedMode !== 'chef_meals' && body.productsClearExisting) {
      const del = await safeDelete(T_PRODUCTS, (q) => q.delete().eq('merchant_id', merchantId));
      if (del.error && !del.skipped) {
        return NextResponse.json(
          { error: del.error.message, details: del.error.details },
          { status: 500 }
        );
      }
      if (del.skipped)
        result.products = {
          ok: true,
          count: 0,
          skippedSave: true,
          reason: `Table ${T_PRODUCTS} missing`,
        };
    }

    // Insert / Upsert products  <<< THIS IS THE PART YOU ASKED ABOUT
    if (seedMode !== 'chef_meals') {
      if (isDry) {
        result.products = {
          ok: true,
          count: products.length,
          items: products.map((p: any) => ({
            title: p.title,
            type: p.type,
            price_usd: p.price_usd,
            image_url: p.image_url ?? null,
            image_data_url: p.image_data_url ?? null,
            blurb: p.blurb ?? null,
          })),
        };
      } else {
        const titles = products.map((p: any) => p.title || 'Item');
        const slugs = await ensureUniqueBatchSlugs(titles, new Set<string>());

        const rows = products.map((p: any, i: number) => ({
          id: randomUUID(),
          merchant_id: merchantId,
          title: p.title || 'Item',
          price_cents: Math.round(Number(p.price_usd) * 100),
          qty_available: 10,
          image_url: p.image_url ?? null,
          product_type: p.type || 'physical',
          slug: p.slug || slugs[i],
          blurb: p.blurb ?? null,
          status: 'active',
        }));

        const up = await safeUpsert(T_PRODUCTS, rows, 'merchant_id,slug');
        if (up.error && !up.skipped) {
          return NextResponse.json(
            { error: up.error.message, details: up.error.details },
            { status: 500 }
          );
        }
        result.products = up.skipped
          ? {
              ok: true,
              count: 0,
              skippedSave: true,
              reason: `Table ${T_PRODUCTS} missing`,
            }
          : { ok: true, count: up.data?.length ?? rows.length };
      }
    }

    // Legacy path (meals) — uses products table with product_type='meal'
    if (seedMode !== 'merchant_products') {
      if (!isDry && body.profileOverwrite && chefId) {
        const u = await safeUpdate(
          'chefs',
          { name: brand?.name ? `Chef ${brand.name}` : null },
          (q) => q.eq('id', chefId)
        );
        if (u.error && !u.skipped) {
          return NextResponse.json(
            { error: u.error.message, details: u.error.details },
            { status: 500 }
          );
        }
      }

      if (!isDry && body.mealsClearExisting) {
        const d = await safeDelete(T_PRODUCTS, (q) =>
          q.delete().eq('merchant_id', merchantId).eq('product_type', 'meal')
        );
        if (d.error && !d.skipped) {
          return NextResponse.json(
            { error: d.error.message, details: d.error.details },
            { status: 500 }
          );
        }
      }

      const mealCount = Math.max(1, Math.min(24, Number(body.mealsCount ?? 6)));
      const candidateMeals = products
        .filter((p: any) => p.type === 'meal')
        .slice(0, mealCount);
      const fallbackMeals = products.slice(0, mealCount);
      const asMeals = candidateMeals.length ? candidateMeals : fallbackMeals;

      if (isDry) {
        result.profile = { ok: true };
        result.meals = {
          ok: true,
          count: asMeals.length,
          items: asMeals.map((m: any) => ({
            title: m.title,
            price_usd: m.price_usd,
            image_url: m.image_url ?? m.image_data_url ?? null,
          })),
        };
      } else {
        const mealTitles = asMeals.map((m: any) => m.title || 'Meal');
        const mealSlugs = await ensureUniqueBatchSlugs(mealTitles, new Set<string>());
        const toInsert = asMeals.map((m: any, i: number) => ({
          id: randomUUID(),
          merchant_id: merchantId,
          title: m.title,
          price_cents: Math.round(Number(m.price_usd) * 100),
          qty_available: 8,
          image_url: m.image_url ?? null,
          product_type: 'meal' as const,
          slug: mealSlugs[i],
          blurb: m.blurb ?? null,
          status: 'active',
        }));
        const upMeals = await safeUpsert(T_PRODUCTS, toInsert, 'merchant_id,slug');
        if (upMeals.error && !upMeals.skipped) {
          return NextResponse.json(
            { error: upMeals.error.message, details: upMeals.error.details },
            { status: 500 }
          );
        }
        result.profile = { ok: true };
        result.meals = upMeals.skipped
          ? { ok: true, count: 0, skippedSave: true, reason: `Table ${T_PRODUCTS} missing` }
          : { ok: true, count: upMeals.data?.length ?? toInsert.length };
      }
    }

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[seed/all] error:', e);
    return NextResponse.json(
      { error: e?.message || 'Server error' },
      { status: 500 }
    );
  }
}
