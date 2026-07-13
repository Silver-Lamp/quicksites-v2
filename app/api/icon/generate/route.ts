// app/api/icon/generate/route.ts
import { getOpenAI } from '@/lib/ai/openaiClient';
import { enforceGuestAiLimit, guestLimitBody } from '@/lib/ai/guestGuard';
import { meterLLMCall, LLMBudgetExceededError } from '@/lib/ai/meter';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// gpt-image-1 generation can take 20–55s; without this the default serverless
// timeout kills the request → 500. 60s is the max on Hobby, fine on Pro.
export const maxDuration = 60;

type Body = {
  template_id?: string;
  business_name?: string;
  industry?: string;
  style?: 'flat' | 'badge' | 'monogram' | 'emblem';
  accent?: string;       // hex like #6D28D9
  initials?: string | null;
  transparent?: boolean; // default true
  size?: '512x512' | '1024x1024';
};

// simple per-instance rate limit
type Bucket = { start: number; count: number };
const mem = (globalThis as any).__aiIconBucket || new Map<string, Bucket>();
(globalThis as any).__aiIconBucket = mem;
function limited(key: string, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || now - b.start > windowMs) { mem.set(key, { start: now, count: 1 }); return false; }
  b.count += 1;
  return b.count > limit;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (arr) => arr.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
        cookieEncoding: 'base64url',
      }
    );

    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    if (limited(`icon:${auth.user.id}:${ip}`)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    }

    const guard = await enforceGuestAiLimit(auth.user, 'icon');
    if (!guard.ok) {
      return new Response(JSON.stringify(guestLimitBody(guard.limit)), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    const { template_id, business_name, industry, style = 'flat', accent = '#6D28D9', initials, transparent = true, size = '1024x1024' } = body;

    // Prefill from DB if template_id present
    let db: any = {};
    if (template_id) {
      const { data } = await supabase
        .from('templates')
        .select('business_name, industry')
        .eq('id', template_id)
        .single();
      db = data || {};
    }

    const biz = (db.business_name ?? business_name ?? '').toString();
    const ind = (db.industry ?? industry ?? 'local services').toString();

    const stylePrompt =
      style === 'badge' ? 'badge emblem, simple geometry, high contrast' :
      style === 'monogram' ? 'monogram mark using provided initials, balanced letterforms' :
      style === 'emblem' ? 'emblematic icon, geometric silhouette' :
      'flat minimal icon mark, vector, crisp edges';

    const textRule = initials ? `Include only the initials "${initials}". Avoid any other words.` : 'No text or letters in the mark.';
    const accentRule = accent ? `Primary accent color ${accent}.` : '';

    const prompt = [
      `${biz ? `${biz} ` : ''}${ind} logo icon.`,
      stylePrompt,
      'Centered, symmetric if appropriate, legible at 64px, good for favicon.',
      textRule,
      accentRule,
      'High quality, clean background.',
    ].filter(Boolean).join(' ');

    const openai = getOpenAI('image');
    let resp;
    try {
      resp = await meterLLMCall(
        { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', route: '/api/icon/generate' },
        async () => {
          const result = await openai.images.generate({
            model: 'gpt-image-1',
            prompt,
            size,
            //   response_format: 'b64_json',
            ...(transparent ? { background: 'transparent' as const } : {}),
          });
          return { value: result, usage: { images: result.data?.length ?? 1, metadata: { size: String(size) } } };
        },
      );
    } catch (e) {
      if (e instanceof LLMBudgetExceededError) {
        return new Response(JSON.stringify({ error: 'AI budget reached, please try again later.' }), {
          status: 429,
          headers: { 'content-type': 'application/json' },
        });
      }
      throw e;
    }

    const b64 = resp.data?.[0]?.b64_json;
    if (!b64) return new Response(JSON.stringify({ error: 'No image returned' }), { status: 500 });

    return new Response(JSON.stringify({ image_base64: b64 }), { status: 200 });
  } catch (e: any) {
    console.error('[icon/generate] error', e);
    return new Response(JSON.stringify({ error: e?.message || 'Icon generation failed' }), { status: 500 });
  }
}
