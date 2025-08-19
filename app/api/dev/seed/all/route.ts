import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Any = any;

function truthy(v?: unknown) {
  if (typeof v === 'boolean') return v;
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

async function requireAuth() {
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
  if (!data.user) {
    throw new Response(JSON.stringify({ error: 'Not signed in' }), { status: 401 });
  }
  return { user: data.user };
}

type RunOpts = {
  // shared
  seed?: string;
  dryRun?: boolean;

  // profile
  profileSeed?: string;
  profileOverwrite?: boolean;
  avatar?: boolean;
  avatarStyle?: 'photo' | 'illustration';
  avatarSize?: '256x256' | '512x512' | '1024x1024';

  // meals
  mealsSeed?: string;
  mealsCount?: number;
  mealsGenerateImages?: boolean;
  mealsImageStyle?: 'photo' | 'illustration';
  mealsImageSize?: '256x256' | '512x512' | '1024x1024';
  mealsClearExisting?: boolean;
};

async function runAll(req: NextRequest, opts: RunOpts) {
  await requireAuth(); // ensure the caller is signed in (child routes also enforce)

  const origin = new URL(req.url).origin;
  const cookieHeader = req.headers.get('cookie') || '';

  const {
    seed,
    dryRun = false,

    profileSeed,
    profileOverwrite = true,
    avatar = true,
    avatarStyle = 'photo',
    avatarSize = '512x512',

    mealsSeed,
    mealsCount = 8,
    mealsGenerateImages = true,
    mealsImageStyle = 'photo',
    mealsImageSize = '512x512',
    mealsClearExisting = true,
  } = opts;

  // 1) Profile: call your existing /api/chef/profile/autofill
  const profileBody = {
    seed: profileSeed ?? seed,
    avatar,
    avatarStyle,
    avatarSize,
    save: !dryRun,
    overwrite: profileOverwrite,
  };

  const profResp = await fetch(`${origin}/api/chef/profile/autofill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(profileBody),
    cache: 'no-store',
  });

  const profileJson = await profResp.json().catch(() => ({} as Any));
  const profileOk = profResp.ok && !profileJson?.error;

  // 2) Meals: call your existing /api/chef/meals/autofill
  const mealsBody = {
    count: mealsCount,
    seed: mealsSeed ?? seed,
    generateImages: mealsGenerateImages,
    imageStyle: mealsImageStyle,
    imageSize: mealsImageSize,
    clearExisting: mealsClearExisting,
    save: !dryRun,
  };

  const mealsResp = await fetch(`${origin}/api/chef/meals/autofill`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(mealsBody),
    cache: 'no-store',
  });

  const mealsJson = await mealsResp.json().catch(() => ({} as Any));
  const mealsOk = mealsResp.ok && !mealsJson?.error;

  const ok = profileOk && mealsOk;

  return NextResponse.json({
    ok,
    mode: dryRun ? 'preview' : 'saved',
    requested: {
      seed,
      profile: profileBody,
      meals: mealsBody,
    },
    profile: {
      ok: profileOk,
      error: profileOk ? undefined : profileJson?.error || 'profile autofill failed',
      ...profileJson,
    },
    meals: {
      ok: mealsOk,
      error: mealsOk ? undefined : mealsJson?.error || 'meals autofill failed',
      ...mealsJson,
    },
  }, { status: ok ? 200 : 207 }); // 207 = multi-status-ish (partial success)
}

/* ---------- GET variant (querystring) ---------- */
export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const q = u.searchParams;

    const seed = q.get('seed') ?? undefined;
    const dryRun = truthy(q.get('dryRun'));

    const profileSeed = q.get('profileSeed') ?? undefined;
    const profileOverwrite = q.get('profileOverwrite') == null ? true : truthy(q.get('profileOverwrite'));
    const avatar = q.get('avatar') == null ? true : truthy(q.get('avatar'));
    const avatarStyle = (q.get('avatarStyle') === 'illustration' ? 'illustration' : 'photo') as 'photo' | 'illustration';
    const avatarSizeQ = (q.get('avatarSize') || '').toLowerCase();
    const avatarSize = (['256x256','512x512','1024x1024'] as const).includes(avatarSizeQ as any)
      ? (avatarSizeQ as any)
      : '512x512';

    const mealsSeed = q.get('mealsSeed') ?? undefined;
    const mealsCount = q.get('mealsCount') ? Math.max(1, Math.min(24, parseInt(q.get('mealsCount')!, 10) || 8)) : 8;
    const mealsGenerateImages = q.get('mealsGenerateImages') == null ? true : truthy(q.get('mealsGenerateImages'));
    const mealsImageStyle = (q.get('mealsImageStyle') === 'illustration' ? 'illustration' : 'photo') as 'photo' | 'illustration';
    const mealsImageSizeQ = (q.get('mealsImageSize') || '').toLowerCase();
    const mealsImageSize = (['256x256','512x512','1024x1024'] as const).includes(mealsImageSizeQ as any)
      ? (mealsImageSizeQ as any)
      : '512x512';
    const mealsClearExisting = q.get('mealsClearExisting') == null ? true : truthy(q.get('mealsClearExisting'));

    return runAll(req, {
      seed, dryRun,
      profileSeed, profileOverwrite, avatar, avatarStyle, avatarSize,
      mealsSeed, mealsCount, mealsGenerateImages, mealsImageStyle, mealsImageSize, mealsClearExisting,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'Seed-all failed' }, { status: 500 });
  }
}

/* ---------- POST variant (JSON body) ---------- */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as Any));

    const seed = body?.seed ?? undefined;
    const dryRun = body?.dryRun ?? false;

    const profileSeed = body?.profileSeed ?? undefined;
    const profileOverwrite = body?.profileOverwrite ?? true;
    const avatar = body?.avatar ?? true;
    const avatarStyle: 'photo' | 'illustration' = body?.avatarStyle === 'illustration' ? 'illustration' : 'photo';
    const avatarSize: '256x256' | '512x512' | '1024x1024' =
      (['256x256','512x512','1024x1024'] as const).includes(body?.avatarSize) ? body.avatarSize : '512x512';

    const mealsSeed = body?.mealsSeed ?? undefined;
    const mealsCount = Math.max(1, Math.min(24, Number(body?.mealsCount ?? 8)));
    const mealsGenerateImages = body?.mealsGenerateImages ?? true;
    const mealsImageStyle: 'photo' | 'illustration' = body?.mealsImageStyle === 'illustration' ? 'illustration' : 'photo';
    const mealsImageSize: '256x256' | '512x512' | '1024x1024' =
      (['256x256','512x512','1024x1024'] as const).includes(body?.mealsImageSize) ? body.mealsImageSize : '512x512';
    const mealsClearExisting = body?.mealsClearExisting ?? true;

    return runAll(req, {
      seed, dryRun,
      profileSeed, profileOverwrite, avatar, avatarStyle, avatarSize,
      mealsSeed, mealsCount, mealsGenerateImages, mealsImageStyle, mealsImageSize, mealsClearExisting,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || 'Seed-all failed' }, { status: 500 });
  }
}
