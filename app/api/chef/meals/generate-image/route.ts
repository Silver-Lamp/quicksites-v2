import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------- logging helpers ----------
type LogFields = Record<string, unknown>;
const isDev = process.env.NODE_ENV !== 'production';

function mkLogger(rid: string) {
  const base = `[imggen ${rid}]`;
  return {
    info: (msg: string, f: LogFields = {}) => console.log(base, msg, JSON.stringify(f)),
    warn: (msg: string, f: LogFields = {}) => console.warn(base, msg, JSON.stringify(f)),
    error: (msg: string, f: LogFields = {}) => console.error(base, msg, JSON.stringify(f)),
  };
}

function redact(s?: string | null, max = 96) {
  if (!s) return '';
  return s.length <= max ? s : `${s.slice(0, max)}…(${s.length})`;
}

function safeErr(e: any) {
  const out: LogFields = {
    name: e?.name,
    message: e?.message,
    status: e?.status ?? e?.code,
  };
  const data = e?.response?.data ?? e?.error ?? e?.response;
  if (data) out.detail = typeof data === 'string' ? redact(data, 300) : data;
  return out;
}

// ---------- presets ----------
const ASPECT_TO_SIZE: Record<string, string> = {
  square: '1024x1024',
  landscape: '1792x1024',
  portrait: '1024x1792',
};
const STYLE_TO_TEXT: Record<string, string> = {
  photo: 'natural light, shallow depth of field, soft shadows, food magazine style',
  studio: 'studio-lit, softly diffused light, crisp edges, high detail',
  rustic: 'wood tabletop, warm tones, natural props, cozy ambiance',
  minimalist: 'clean neutral background, simple plating, negative space',
  festive: 'vibrant, celebratory, appetizing glow (no confetti, no people)',
};

function buildPrompt(input: {
  title?: string;
  description?: string;
  cuisines?: string[];
  style?: string;
}) {
  const lines = [
    `Appetizing food photograph of: ${input.title ?? 'meal'}.`,
    input.description ? `Description: ${input.description}` : '',
    input.cuisines?.length ? `Cuisine: ${input.cuisines.join(', ')}` : '',
    STYLE_TO_TEXT[input.style ?? 'photo'],
    'Single plated dish in frame, neutral/restaurant backdrop.',
    'No text, no logos, no watermark, no hands, no people.',
    'High detail, realistic textures, steam if hot, crisp focus.',
  ].filter(Boolean);
  return lines.join('\n');
}

async function assertUser() {
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
  return data.user;
}

async function fetchImageAsBuffer(url: string, log: ReturnType<typeof mkLogger>) {
  const t = Date.now();
  const res = await fetch(url);
  if (!res.ok) {
    log.warn('fetch:url_image:bad_status', { status: res.status, url: redact(url, 160) });
    throw new Error(`Failed to fetch image (${res.status})`);
  }
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  log.info('fetch:url_image:ok', { ms: Date.now() - t, bytes: buf.length });
  return buf;
}

export async function POST(req: NextRequest) {
  const rid = randomUUID();
  const t0 = Date.now();
  const log = mkLogger(rid);
  const wantDebug = isDev && (req.headers.get('x-debug') === '1');

  log.info('request:start', {
    ua: req.headers.get('user-agent'),
    ip: req.headers.get('x-forwarded-for'),
    envHasOpenAI: !!process.env.OPENAI_API_KEY,
    envHasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    envHasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!process.env.OPENAI_API_KEY) {
    log.error('env:missing_openai_key');
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured', rid }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    title = '',
    description = '',
    cuisines = [] as string[],
    style = 'photo',
    aspect = 'square',
    bucket = 'meals',
  } = body || {};

  log.info('request:body', {
    title: redact(title, 120),
    description: redact(description, 240),
    cuisines,
    style,
    aspect,
    bucket,
  });

  if (!title && !description) {
    log.warn('validation:missing_title_and_description');
    return NextResponse.json({ error: 'Provide a title or description', rid }, { status: 400 });
  }

  // Auth
  let user: any;
  const tAuth = Date.now();
  try {
    user = await assertUser();
    log.info('auth:ok', { ms: Date.now() - tAuth, user_id: user.id });
  } catch (e: any) {
    if (e instanceof Response) {
      log.warn('auth:fail', { ms: Date.now() - tAuth });
      return new NextResponse(e.body, { status: e.status, headers: e.headers });
    }
    log.error('auth:error', { ms: Date.now() - tAuth, err: safeErr(e) });
    return NextResponse.json({ error: 'Auth failed', rid }, { status: 401 });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const prompt = buildPrompt({ title, description, cuisines, style });
  const size = ASPECT_TO_SIZE[aspect] ?? '1024x1024';

  log.info('prompt:built', { size, length: prompt.length, preview: redact(prompt, 300) });

  // Generate image
  let modelUsed: 'dall-e-3' | 'gpt-image-1' = 'dall-e-3';
  let bytes: Buffer | null = null;

  // 1) Try DALLE-3 (ask for b64 explicitly)
  try {
    const tGen = Date.now();
    log.info('openai:generate:start', { model: 'dall-e-3', size });
    const r = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: size as any,
      quality: 'hd',
      n: 1,
      response_format: 'b64_json', // <-- force b64
    });
    const item = r.data?.[0] ?? {};
    log.info('openai:generate:result', {
      model: 'dall-e-3',
      ms: Date.now() - tGen,
      hasB64: !!item?.b64_json,
      hasUrl: !!(item as any)?.url,
    });

    if (item?.b64_json) {
      bytes = Buffer.from(item.b64_json, 'base64');
      log.info('openai:decode:b64', { bytes: bytes.length });
    } else if ((item as any)?.url) {
      // Some orgs/accounts default to URL even when b64 requested; handle it.
      bytes = await fetchImageAsBuffer((item as any).url, log);
    }
  } catch (e: any) {
    log.warn('openai:generate:dalle3_fail', { err: safeErr(e) });
  }

  // 2) Fallback to gpt-image-1 (square) if DALLE-3 didn’t give bytes
  if (!bytes) {
    try {
      modelUsed = 'gpt-image-1';
      const tFallback = Date.now();
      log.info('openai:generate:fallback:start', { model: 'gpt-image-1', size: '1024x1024' });
      const r = await openai.images.generate({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024' as any,
        n: 1,
        response_format: 'b64_json',
      });
      const item = r.data?.[0] ?? {};
      log.info('openai:generate:fallback:result', {
        model: 'gpt-image-1',
        ms: Date.now() - tFallback,
        hasB64: !!item?.b64_json,
        hasUrl: !!(item as any)?.url,
      });

      if (item?.b64_json) {
        bytes = Buffer.from(item.b64_json, 'base64');
        log.info('openai:decode:b64', { bytes: bytes.length });
      } else if ((item as any)?.url) {
        bytes = await fetchImageAsBuffer((item as any).url, log);
      }
    } catch (e2: any) {
      log.error('openai:generate:fallback_fail', { err: safeErr(e2) });
    }
  }

  if (!bytes) {
    log.error('openai:no_bytes_after_all');
    return NextResponse.json({ error: 'Image generation returned empty result', rid }, { status: 500 });
  }

  // Upload to Supabase Storage
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const key = `meal-images/${user.id}/${randomUUID()}.png`;

  async function tryUpload(bkt: string) {
    const t = Date.now();
    log.info('storage:upload:start', { bucket: bkt, key, bytes: bytes!.length });
    const up = await admin.storage.from(bkt).upload(key, bytes!, {
      contentType: 'image/png',
      upsert: false,
    });
    if (up.error) {
      log.warn('storage:upload:fail', { bucket: bkt, err: safeErr(up.error) });
      return { ok: false as const, error: up.error };
    }
    const { data } = admin.storage.from(bkt).getPublicUrl(key);
    log.info('storage:upload:ok', { bucket: bkt, ms: Date.now() - t, publicUrl: data.publicUrl });
    return { ok: true as const, url: data.publicUrl };
  }

  const primary = await tryUpload(bucket);
  let finalUrl: string;
  if (!primary.ok) {
    if (bucket !== 'meals') {
      const fallback = await tryUpload('meals');
      if (!fallback.ok) {
        log.error('storage:upload:both_failed', { err: safeErr(primary.error) });
        return NextResponse.json({ error: 'Upload failed', rid }, { status: 500 });
      }
      finalUrl = fallback.url!;
    } else {
      return NextResponse.json({ error: 'Upload failed', rid }, { status: 500 });
    }
  } else {
    finalUrl = primary.url!;
  }

  log.info('request:done', { totalMs: Date.now() - t0, modelUsed, finalUrl: redact(finalUrl, 300) });

  const resBody: any = { ok: true, url: finalUrl, rid };
  if (wantDebug) {
    resBody.debug = {
      modelUsed,
      size,
      promptPreview: redact(prompt, 380),
      bytes: bytes.length,
      bucketUsed: (primary.ok ? bucket : 'meals'),
      key,
      totalMs: Date.now() - t0,
    };
  }

  return NextResponse.json(resBody, { headers: { 'x-request-id': rid } });
}
