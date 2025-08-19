// app/api/chef/meals/autofill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Json = Record<string, any>;
type Any = any;

/* ---------------- helpers: error parsing ---------------- */
const msgLower = (e: Any) => `${e?.message ?? ''} ${e?.details ?? ''}`.toLowerCase();
const missingCol = (e: Any, table?: string) => {
  const m = msgLower(e);
  if (!table) return /does not exist|could not find the/.test(m);
  const a = m.match(new RegExp(`could not find the '(.+?)' column of '${table}'`));
  if (a?.[1]) return a[1];
  const b = m.match(new RegExp(`column "(.+?)" of relation "${table}" does not exist`));
  if (b?.[1]) return b[1];
  const c = m.match(new RegExp(`column ${table}\\.([a-z0-9_]+) does not exist`));
  if (c?.[1]) return c[1];
  return /does not exist|could not find the/.test(m) ? 'unknown' : null;
};
const truthy = (v?: unknown) => {
  if (typeof v === 'boolean') return v;
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
};

/* ---------------- auth / supabase ---------------- */
async function serverClient() {
  const jar = await cookies();
  const supa = createServerClient(
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
  const { data } = await supa.auth.getUser();
  if (!data.user) throw new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
  return { supa, user: data.user };
}

async function findOrCreateChef(supa: Any, userId: string, fallbackName: string) {
  try {
    const a = await supa.from('chefs').select('id, user_id, merchant_id, name').eq('user_id', userId).maybeSingle();
    if (!a.error && a.data) return a.data;
  } catch {}

  try {
    const m = await supa.from('merchants').select('id').eq('user_id', userId).maybeSingle();
    const merchId = m.data?.id as string | undefined;
    if (merchId) {
      const b = await supa.from('chefs').select('id, user_id, merchant_id, name').eq('merchant_id', merchId).maybeSingle();
      if (!b.error && b.data) return b.data;
      const id = randomUUID();
      const payloads: Json[] = [
        { id, name: fallbackName, user_id: userId, merchant_id: merchId },
        { id, name: fallbackName, user_id: userId },
        { id, name: fallbackName, merchant_id: merchId },
        { id, name: fallbackName },
      ];
      for (const p of payloads) {
        const ins = await supa.from('chefs' as Any).insert(p);
        if (!ins.error) return { id, merchant_id: merchId, user_id: userId, name: fallbackName } as Any;
        if (!missingCol(ins.error, 'chefs')) throw ins.error;
      }
    }
  } catch {}

  const id = randomUUID();
  const attempts: Json[] = [
    { id, name: fallbackName, user_id: userId },
    { id, name: fallbackName },
  ];
  for (const p of attempts) {
    const ins = await supa.from('chefs' as Any).insert(p);
    if (!ins.error) return { id, user_id: userId, name: fallbackName } as Any;
    if (!missingCol(ins.error, 'chefs')) throw ins.error;
  }
  const any = await supa.from('chefs').select('id, user_id, merchant_id, name').limit(1);
  if (!any.error && any.data?.[0]) return any.data[0];
  throw new Error('Could not find or create chef');
}

/* ---------------- data-url -> Supabase upload ---------------- */
async function uploadDataUrlToBucket(dataUrl?: string | null, bucketPref?: string) {
  const src = (dataUrl ?? '').trim();
  if (!src.startsWith('data:image/')) return src || null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = bucketPref || process.env.MEAL_IMAGES_BUCKET || process.env.PROFILE_IMAGES_BUCKET || 'public';
  if (!supabaseUrl || !serviceKey) return src;

  const m = src.match(/^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return src;
  const contentType = m[1];
  const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
  const b64 = m[3];
  const buffer = Buffer.from(b64, 'base64');

  const admin = createAdminClient(supabaseUrl, serviceKey);
  const path = `meals/generated/${randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) return src;
  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl || src;
}

/* ---------------- random meal generator (seeded) ---------------- */
function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pick<T>(arr: T[], rnd: () => number) { return arr[Math.floor(rnd() * arr.length)]; }

const CUISINES = ["Mexican","Thai","Italian","Indian","Mediterranean","Korean","Japanese","American","Vietnamese","Middle Eastern"];
const ADJ = ["roasted","citrus-herb","garlic-ginger","smoky","maple-chili","balsamic","sesame","lemon-pepper","creamy","spiced"];
const BASES = ["chicken","tofu","salmon","beef","pork","tempeh","chickpea","mushroom","eggplant","shrimp"];
const FORMS = ["bowl","salad","tacos","pasta","stir-fry","curry","stew","flatbread","grain bowl","wraps"];
const SIDES = ["garlic rice","herbed quinoa","roasted veggies","pickled cucumbers","cilantro-lime slaw","sesame greens"];
const DESSERTS = ["lemon bars","chocolate brownie","apple crumble","panna cotta","rice pudding","matcha cookie"];

type MealGen = {
  name: string;
  description: string;
  category: 'entree' | 'side' | 'dessert';
  cuisine: string;
  price: number;
  price_cents: number;
};

function buildRandomMeals(count: number, seed?: string): MealGen[] {
  const rnd = seed ? mulberry32(hashSeed(seed)) : Math.random;
  const meals: MealGen[] = [];
  for (let i = 0; i < count; i++) {
    const cat = (i % 5 === 4) ? 'dessert' : ((i % 3 === 2) ? 'side' : 'entree') as MealGen['category'];
    const cuisine = pick(CUISINES, rnd);
    if (cat === 'dessert') {
      const d = pick(DESSERTS, rnd);
      const name = `${d} (${cuisine})`;
      const price = Math.round((4 + rnd()*5) * 100) / 100;
      meals.push({
        name,
        description: `House-made ${d}, lightly sweet and balanced. ${cuisine} twist.`,
        category: cat, cuisine, price, price_cents: Math.round(price * 100),
      });
    } else if (cat === 'side') {
      const s = pick(SIDES, rnd);
      const name = `${s.charAt(0).toUpperCase()+s.slice(1)} (${cuisine})`;
      const price = Math.round((4 + rnd()*5) * 100) / 100;
      meals.push({
        name,
        description: `A perfect companion: ${s}, made fresh daily with ${cuisine} flavors.`,
        category: cat, cuisine, price, price_cents: Math.round(price * 100),
      });
    } else {
      const a = pick(ADJ, rnd);
      const b = pick(BASES, rnd);
      const f = pick(FORMS, rnd);
      const name = `${a} ${b} ${f} (${cuisine})`;
      const price = Math.round((11 + rnd()*8) * 100) / 100;
      meals.push({
        name,
        description: `Comforting ${f} featuring ${a} ${b}, finished with bright ${cuisine} accents.`,
        category: cat, cuisine, price, price_cents: Math.round(price * 100),
      });
    }
  }
  return meals;
}

/* ---------------- core runner (shared by GET/POST) ---------------- */
type RunOpts = {
  count?: number;
  seed?: string;
  generateImages?: boolean;
  imageStyle?: 'photo' | 'illustration';
  imageSize?: '256x256' | '512x512' | '1024x1024';
  save?: boolean;
  clearExisting?: boolean;
  bucket?: string | null;
  origin: string;
};

async function runAutofill(req: NextRequest, opts: RunOpts) {
  const { supa, user } = await serverClient();

  const {
    count = 6,
    seed,
    generateImages = true,
    imageStyle = 'photo',
    imageSize = '512x512',
    save = true,
    clearExisting = false,
    bucket: bucketOverride,
    origin,
  } = opts;

  const chefName = (user.user_metadata as Any)?.name || user.email?.split('@')[0] || 'Chef';
  const chef = await findOrCreateChef(supa, user.id, chefName);

  // Optionally clear existing rows
  if (truthy(clearExisting)) {
    const del1 = await supa.from('meals' as Any).delete().eq('chef_id', chef.id);
    if (del1.error && !missingCol(del1.error, 'meals')) throw del1.error;
    if (del1.error) {
      const del2 = await supa.from('meals' as Any).delete().eq('merchant_id', chef.merchant_id ?? '___nope___');
      if (del2.error && !missingCol(del2.error, 'meals')) throw del2.error;
    }
  }

  // Build rows
  const items = buildRandomMeals(Math.min(Math.max(1, Number(count) || 1), 24), seed);
  const rows: Json[] = items.map((m) => ({
    id: randomUUID(),
    name: m.name,
    description: m.description,
    category: m.category,
    cuisine: m.cuisine,
    price_cents: m.price_cents,
    price: m.price,
    photo_url: null,
    active: true,
    chef_id: chef.id,
    merchant_id: chef.merchant_id ?? null,
  }));

  // Optional AI images
  if (truthy(generateImages)) {
    for (let i = 0; i < rows.length; i++) {
      const meal = items[i];
      try {
        const resp = await fetch(`${origin}/api/dev/generate-meal-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: meal.name,
            cuisine: meal.cuisine,
            style: imageStyle,
            size: imageSize,
          }),
        });
        const data = await resp.json().catch(() => null);
        let url: string | null = data?.imageUrl || data?.dataUrl || null;
        if (url && url.startsWith('data:image/')) {
          url = await uploadDataUrlToBucket(url, bucketOverride ?? undefined);
        }
        rows[i].photo_url = url || null;
      } catch { rows[i].photo_url = rows[i].photo_url ?? null; }
    }
  }

  if (!truthy(save)) {
    return NextResponse.json({
      ok: true,
      saved: false,
      chef: { id: chef.id, merchant_id: chef.merchant_id ?? null },
      items: rows,
    });
  }

  // Insert rows; adaptively drop missing columns
  const tryInsert = async (payloadRows: Json[]) =>
    (await supa.from('meals' as Any).insert(payloadRows).select('id'));

  let current = rows;
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error, data } = await tryInsert(current);
    if (!error) {
      return NextResponse.json({
        ok: true,
        saved: true,
        count: current.length,
        chef: { id: chef.id, merchant_id: chef.merchant_id ?? null },
        ids: data?.map((d: Any) => d.id) ?? [],
        items: current,
      });
    }
    const miss = missingCol(error, 'meals');
    if (!miss || miss === 'unknown') {
      const m = msgLower(error);
      if (m.includes('row-level security')) {
        return NextResponse.json({ error: 'RLS blocked insert. Ensure policy allows a chef to insert their meals.' }, { status: 403 });
      }
      const dropList = ['merchant_id','chef_id','category','cuisine','price_cents','price','photo_url','active','description'];
      const drop = dropList.find((k) => k in (current[0] || {}));
      if (!drop) throw error;
      current = current.map((r) => { const { [drop]: _omit, ...rest } = r; return rest; });
    } else {
      current = current.map((r) => { const c = { ...r } as Any; delete c[miss as string]; return c; });
    }
  }

  return NextResponse.json({ error: 'Insert failed after adaptations' }, { status: 500 });
}

/* ---------------- GET: querystring variant ---------------- */
export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const q = u.searchParams;
  const count = q.get('count');
  const seed = q.get('seed') ?? undefined;
  const save = q.get('save');
  const clearExisting = q.get('clearExisting');
  const generateImages = q.get('generateImages'); // default true
  const imageStyleQ = (q.get('imageStyle') || '').toLowerCase();
  const imageSizeQ = (q.get('imageSize') || '').toLowerCase() as
    '256x256' | '512x512' | '1024x1024' | '';
  const bucket = q.get('bucket');

  const imageStyle: 'photo' | 'illustration' =
    imageStyleQ === 'illustration' ? 'illustration' : 'photo';
  const imageSize: '256x256' | '512x512' | '1024x1024' =
    (['256x256','512x512','1024x1024'] as const).includes(imageSizeQ as any)
      ? (imageSizeQ as any)
      : '512x512';

  return runAutofill(req, {
    origin: u.origin,
    count: count ? Math.max(1, Math.min(24, parseInt(count, 10) || 1)) : 6,
    seed,
    save: save == null ? true : truthy(save),
    clearExisting: truthy(clearExisting),
    generateImages: generateImages == null ? true : truthy(generateImages),
    imageStyle,
    imageSize,
    bucket: bucket ?? null,
  });
}

/* ---------------- POST: JSON body variant ---------------- */
export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const body = await req.json().catch(() => ({} as any));

  const imageStyle: 'photo' | 'illustration' =
    (body?.imageStyle === 'illustration' ? 'illustration' : 'photo');
  const imageSize: '256x256' | '512x512' | '1024x1024' =
    (['256x256','512x512','1024x1024'] as const).includes(body?.imageSize) ? body.imageSize : '512x512';

  return runAutofill(req, {
    origin: u.origin,
    count: Math.max(1, Math.min(24, Number(body?.count ?? 6))),
    seed: body?.seed,
    save: body?.save == null ? true : truthy(body?.save),
    clearExisting: truthy(body?.clearExisting),
    generateImages: body?.generateImages == null ? true : truthy(body?.generateImages),
    imageStyle,
    imageSize,
    bucket: typeof body?.bucket === 'string' ? body.bucket : null,
  });
}
