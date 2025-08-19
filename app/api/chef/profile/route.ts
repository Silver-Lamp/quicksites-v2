import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Json = Record<string, any>;
type Any = any;

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

const truthy = (v?: string | null) =>
  v === '1' || v === 'true' || v === 'yes' || v === 'on';

function coalesceName(display?: string, meta?: string, email?: string) {
  return (display?.trim() || meta?.trim() || email?.split('@')[0] || 'Chef').trim();
}

/* ---------------- YouTube -> embed normalizer ---------------- */
function normalizeYouTubeToEmbed(input?: string): string | undefined {
  const raw = (input ?? '').trim();
  if (!raw) return undefined;
  const ID = /^[A-Za-z0-9_-]{11}$/;
  if (ID.test(raw)) return `https://www.youtube.com/embed/${raw}`;
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`); } catch { return undefined; }
  const host = u.hostname.replace(/^www\./i, '');
  const isYT = ['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host);
  if (!isYT) return undefined;
  let id = '';
  if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/embed/')[1]?.split('/')[0] ?? '';
  else if (host === 'youtu.be') id = u.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  else if (u.pathname === '/watch') id = u.searchParams.get('v') ?? '';
  else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/shorts/')[1]?.split('/')[0] ?? '';
  else if (u.pathname.startsWith('/live/')) id = u.pathname.split('/live/')[1]?.split('/')[0] ?? '';
  if (!ID.test(id)) return undefined;
  const start = u.searchParams.get('start') ?? u.searchParams.get('t');
  const list  = u.searchParams.get('list') ?? undefined;
  const toSec = (v: string | null) => {
    if (!v) return undefined;
    if (/^\d+$/.test(v)) return parseInt(v, 10);
    const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!m) return undefined;
    const h = parseInt(m[1] || '0', 10), m2 = parseInt(m[2] || '0', 10), s = parseInt(m[3] || '0', 10);
    const total = h * 3600 + m2 * 60 + s;
    return total > 0 ? total : undefined;
  };
  const params = new URLSearchParams();
  const t = toSec(start); if (t) params.set('start', String(t));
  if (list) params.set('list', list);
  const qs = params.toString();
  return `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ''}`;
}

/* ---------------- Certifications sanitizer ---------------- */
function normalizeCertifications(input?: unknown): string[] | null {
  const arr = Array.isArray(input) ? input : [];
  const cleaned = Array.from(new Set(
    arr.map((s) => (typeof s === 'string' ? s.trim() : ''))
       .filter(Boolean)
       .map((s) => s.slice(0, 140))
  ));
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, 20);
}

/* ---------------- Data URL -> Supabase upload ---------------- */
async function maybeUploadDataUrlToPublicBucket(dataUrl?: string | null): Promise<string | null | undefined> {
  const src = (dataUrl ?? '').trim();
  if (!src.startsWith('data:image/')) return src || null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.PROFILE_IMAGES_BUCKET || 'public';
  if (!supabaseUrl || !serviceKey) return src;

  const m = src.match(/^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return src;
  const contentType = m[1];
  const ext = m[2] === 'jpeg' || m[2] === 'jpg' ? 'jpg' : m[2];
  const b64 = m[3];
  const buffer = Buffer.from(b64, 'base64');

  const admin = createAdminClient(supabaseUrl, serviceKey);
  const path = `profiles/ai-avatars/${randomUUID()}.${ext}`;
  const { error } = await admin.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) return src;

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl || src;
}

/* ---------------- Supabase helpers ---------------- */
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
    const a = await supa.from('chefs').select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications').eq('user_id', userId).maybeSingle();
    if (!a.error && a.data) return a.data;
  } catch {}

  try {
    const m = await supa.from('merchants').select('id').eq('user_id', userId).maybeSingle();
    const merchId = m.data?.id as string | undefined;
    if (merchId) {
      const b = await supa.from('chefs').select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications').eq('merchant_id', merchId).maybeSingle();
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
  const any = await supa.from('chefs').select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications').limit(1);
  if (!any.error && any.data?.[0]) return any.data[0];
  throw new Error('Could not find or create chef');
}

/* ---------------- Random profile (deterministic with seed) ---------------- */
type RandomChefProfile = {
  name: string;
  location: string;
  youtube_url: string;
  bio: string;
  certifications_multiline: string;
};

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
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const FIRST = ["Ava","Maya","Jon","Nora","Mateo","Luca","Ivy","Owen","Aria","Kai","Leah","Milo","Zoë","Theo","Ruby","Ezra","Sofia","Ada","Noah","Elena"];
const LAST  = ["Nguyen","Rivera","Kim","Patel","Santos","Chen","Ali","Martinez","Singh","Brown","Lopez","Wang","Garcia","Hughes","Silva","Parker","Khan","Cohen","Harris","Diaz"];
const CITIES = [
  ["Seattle","WA"],["Portland","OR"],["Austin","TX"],["Nashville","TN"],["Madison","WI"],
  ["Boise","ID"],["Tucson","AZ"],["Asheville","NC"],["Boulder","CO"],["Providence","RI"],
  ["Savannah","GA"],["Santa Fe","NM"],["San Luis Obispo","CA"],["Ann Arbor","MI"],["Spokane","WA"],
];
const SPECIALTIES = [
  "family-style comfort food","seasonal vegetarian plates","weeknight Thai-inspired dishes",
  "BBQ & smoked favorites","gluten-free baking","Mediterranean small plates",
  "Korean home cooking","Mexican classics","cozy soups & stews","lacto-fermented sides",
];
const VIBE = [
  "locally sourced","budget-friendly","kid-approved","crowd-pleasing","from-scratch",
  "farmers market","slow-cooked","bold & spicy","simple, clean flavors","big-batch",
];
const DEMO_YT = ["r3i7tA5Gk3U","Hc9M6_8tJmM","Uj2R8lpcH3U","8p7ImH4gI3Y","L6mE6o3n8bQ"];
const CERTS = [
  "Food Handler Card",
  "Allergen Awareness Certificate",
  "WA Cottage Food (home kitchen) – self-certified",
  "ServSafe Manager (in progress)",
];
function pick<T>(arr: T[], rnd: () => number) {
  return arr[Math.floor(rnd() * arr.length)];
}
function buildRandomProfile(seed?: string): RandomChefProfile {
  const rnd = seed ? mulberry32(hashSeed(seed)) : Math.random;
  const fullName = `${pick(FIRST, rnd)} ${pick(LAST, rnd)}`;
  const [city, st] = pick(CITIES, rnd);
  const spec = pick(SPECIALTIES, rnd);
  const tone = pick(VIBE, rnd);
  const bio = [
    `Hi, I’m ${fullName}. I cook ${spec} from my ${tone} kitchen in ${city}.`,
    `Menus rotate weekly—small batches, labeled ingredients, and recyclable packaging.`,
    `I keep things ${pick(["simple","seasonal","hearty","fresh"], rnd)} and ${pick(["honest","affordable","delicious"], rnd)}.`
  ].join(' ');
  const certs = [
    CERTS[0],
    rnd() > 0.5 ? CERTS[1] : undefined,
    rnd() > 0.65 ? CERTS[2] : undefined,
    rnd() > 0.8 ? CERTS[3] : undefined,
  ].filter(Boolean).join('\n');
  const yt = `https://www.youtube.com/watch?v=${pick(DEMO_YT, rnd)}`;
  return { name: fullName, location: `${city}, ${st}`, youtube_url: yt, bio, certifications_multiline: certs };
}

/* ---------------- Routes ---------------- */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const isRandom = truthy(url.searchParams.get('random'));

    if (isRandom) {
      const seed = url.searchParams.get('seed') ?? undefined;
      const saveIt = truthy(url.searchParams.get('save'));
      const wantAvatar = truthy(url.searchParams.get('avatar'));
      const avatarStyleQ = (url.searchParams.get('avatarStyle') || '').toLowerCase();
      const avatarSizeQ = (url.searchParams.get('avatarSize') || '').toLowerCase() as
        '256x256' | '512x512' | '1024x1024' | '';

      const style: 'photo' | 'illustration' =
        avatarStyleQ === 'illustration' ? 'illustration' : 'photo';
      const size: '256x256' | '512x512' | '1024x1024' =
        (['256x256','512x512','1024x1024'] as const).includes(avatarSizeQ as any)
          ? (avatarSizeQ as any)
          : '512x512';

      const rnd = buildRandomProfile(seed);
      const randomPayload = {
        name: rnd.name,
        location: rnd.location,
        bio: rnd.bio,
        kitchen_video_url: rnd.youtube_url,
        kitchen_video_url_embed: normalizeYouTubeToEmbed(rnd.youtube_url) ?? null,
        certifications: rnd.certifications_multiline.split('\n').map(s => s.trim()).filter(Boolean),
        certifications_multiline: rnd.certifications_multiline,
        profile_image_url: '' as string,      // will fill if avatar requested
        avatar_generated: false as boolean,
      };

      // Optionally generate avatar via your internal endpoint
      let avatarUrl: string | undefined;
      if (wantAvatar) {
        const origin = url.origin;
        const resp = await fetch(`${origin}/api/dev/generate-chef-avatar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seedName: rnd.name, style, size }),
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok && data) {
          avatarUrl = data.imageUrl || data.dataUrl;
          randomPayload.profile_image_url = avatarUrl || '';
          randomPayload.avatar_generated = !!avatarUrl;
        }
      }

      if (!saveIt) {
        return NextResponse.json({ ok: true, saved: false, random: randomPayload });
      }

      // save to DB (auth required)
      const { supa, user } = await serverClient();
      const baseName = coalesceName(randomPayload.name, (user.user_metadata as Any)?.name, user.email ?? undefined);
      const chef = await findOrCreateChef(supa, user.id, baseName);

      // If avatar is a data URL, upload to Storage for a persistent public URL
      let imageForSave = avatarUrl || '';
      try { imageForSave = (await maybeUploadDataUrlToPublicBucket(imageForSave)) || ''; } catch {}

      const attempt = async (payload: Json) =>
        supa.from('chefs' as Any).update(payload).eq('id', chef.id).select('id').maybeSingle();

      let payload: Json = {
        name: randomPayload.name,
        location: randomPayload.location,
        bio: randomPayload.bio,
        profile_image_url: imageForSave || null,
        kitchen_video_url: randomPayload.kitchen_video_url_embed ?? null,
        certifications: randomPayload.certifications,
      };

      while (true) {
        const { error } = await attempt(payload);
        if (!error) break;
        const miss = missingCol(error, 'chefs');
        if (!miss || !(typeof miss === 'string' && miss in payload)) {
          const m = msgLower(error);
          if (m.includes('row-level security')) {
            return NextResponse.json({ error: 'RLS blocked update. Ensure policy allows a chef to update their own row.' }, { status: 403 });
          }
          throw error;
        }
        delete (payload as Any)[miss as string];
      }

      const after = await supa
        .from('chefs')
        .select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications')
        .eq('id', chef.id)
        .maybeSingle();

      return NextResponse.json({
        ok: true,
        saved: true,
        random: randomPayload,
        chef: after.data ?? chef,
      });
    }

    // --- Default: existing find-or-create read path ---
    const { supa, user } = await serverClient();
    const baseName = coalesceName(undefined, (user.user_metadata as Any)?.name, user.email ?? undefined);
    const chef = await findOrCreateChef(supa, user.id, baseName);
    return NextResponse.json({ ok: true, chef });
  } catch (e: Any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'Failed to load' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supa, user } = await serverClient();
    const body = (await req.json()) as {
      name?: string;
      location?: string;
      bio?: string;
      profile_image_url?: string;
      kitchen_video_url?: string;
      certifications?: string[] | null;
    };

    if (typeof body.kitchen_video_url === 'string') {
      const norm = normalizeYouTubeToEmbed(body.kitchen_video_url);
      body.kitchen_video_url = norm ?? '';
    }

    let normalizedImageUrl = body.profile_image_url?.trim() || '';
    try { normalizedImageUrl = (await maybeUploadDataUrlToPublicBucket(normalizedImageUrl)) || ''; } catch {}

    const normalizedCerts = normalizeCertifications(body.certifications);

    const baseName = coalesceName(body.name, (user.user_metadata as Any)?.name, user.email ?? undefined);
    const chef = await findOrCreateChef(supa, user.id, baseName);

    const attempt = async (payload: Json) =>
      supa.from('chefs' as Any).update(payload).eq('id', chef.id).select('id').maybeSingle();

    let payload: Json = {
      name: (body.name ?? chef.name ?? baseName) || baseName,
      location: body.location ?? chef.location ?? null,
      bio: body.bio ?? chef.bio ?? null,
      profile_image_url: normalizedImageUrl || chef.profile_image_url || null,
      kitchen_video_url: body.kitchen_video_url ?? chef.kitchen_video_url ?? null,
      certifications: normalizedCerts ?? chef.certifications ?? null,
    };

    while (true) {
      const { error } = await attempt(payload);
      if (!error) break;
      const miss = missingCol(error, 'chefs');
      if (!miss || !(typeof miss === 'string' && miss in payload)) {
        const m = msgLower(error);
        if (m.includes('row-level security')) {
          return NextResponse.json({ error: 'RLS blocked update. Ensure policy allows a chef to update their own row.' }, { status: 403 });
        }
        throw error;
      }
      delete (payload as Any)[miss as string];
    }

    const after = await supa
      .from('chefs')
      .select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications')
      .eq('id', chef.id)
      .maybeSingle();
    return NextResponse.json({ ok: true, chef: after.data ?? chef });
  } catch (e: Any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'Failed to save' }, { status: 500 });
  }
}
