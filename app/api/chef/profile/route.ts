import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
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

function coalesceName(display?: string, meta?: string, email?: string) {
  return (display?.trim() || meta?.trim() || email?.split('@')[0] || 'Chef').trim();
}

// Minimal YouTube -> embed normalizer (same behavior as your editor)
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
  // 1) by user_id (if column exists)
  try {
    const a = await supa.from('chefs').select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications').eq('user_id', userId).maybeSingle();
    if (!a.error && a.data) return a.data;
  } catch {}

  // 2) via merchants → chefs.merchant_id
  try {
    const m = await supa.from('merchants').select('id').eq('user_id', userId).maybeSingle();
    const merchId = m.data?.id as string | undefined;
    if (merchId) {
      const b = await supa.from('chefs').select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications').eq('merchant_id', merchId).maybeSingle();
      if (!b.error && b.data) return b.data;
      // create a chef tied to this merchant
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

  // 3) bare create (last resort)
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
  // fallback to any row
  const any = await supa.from('chefs').select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications').limit(1);
  if (!any.error && any.data?.[0]) return any.data[0];
  throw new Error('Could not find or create chef');
}

export async function GET() {
  try {
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

    // normalize video
    if (typeof body.kitchen_video_url === 'string') {
      const norm = normalizeYouTubeToEmbed(body.kitchen_video_url);
      body.kitchen_video_url = norm ?? '';
    }

    const baseName = coalesceName(body.name, (user.user_metadata as Any)?.name, user.email ?? undefined);
    const chef = await findOrCreateChef(supa, user.id, baseName);

    // adaptive update (drop columns that don't exist)
    const attempt = async (payload: Json) =>
      supa.from('chefs' as Any).update(payload).eq('id', chef.id).select('id').maybeSingle();

    let payload: Json = {
      name: body.name ?? chef.name ?? baseName,
      location: body.location ?? chef.location ?? null,
      bio: body.bio ?? chef.bio ?? null,
      profile_image_url: body.profile_image_url ?? chef.profile_image_url ?? null,
      kitchen_video_url: body.kitchen_video_url ?? chef.kitchen_video_url ?? null,
      certifications: Array.isArray(body.certifications) ? body.certifications : chef.certifications ?? null,
    };

    // try update, dropping missing columns as needed
    while (true) {
      const { error } = await attempt(payload);
      if (!error) break;
      const miss = missingCol(error, 'chefs');
      if (!miss || !(typeof miss === 'string' && miss in payload)) {
        const m = msgLower(error);
        if (m.includes('row-level security')) return NextResponse.json({ error: 'RLS blocked update. Ensure policy allows a chef to update their own row.' }, { status: 403 });
        throw error;
      }
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (payload as Any)[miss as string];
    }

    // reselect
    const after = await supa.from('chefs').select('id, user_id, merchant_id, name, location, bio, profile_image_url, kitchen_video_url, certifications').eq('id', chef.id).maybeSingle();
    return NextResponse.json({ ok: true, chef: after.data ?? chef });
  } catch (e: Any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'Failed to save' }, { status: 500 });
  }
}
