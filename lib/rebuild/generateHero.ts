// lib/rebuild/generateHero.ts
//
// Optional fresh hero image for an AI rebuild. The scraped og:image is the OLD
// site's branding (often stale/low-res/off-brand), which undercuts the "this is an
// upgrade" moment. When REBUILD_HERO_ENABLED=true we generate a clean, on-brand hero
// instead — best-effort: any failure falls back to the scraped image, so the rebuild
// never breaks on image gen. Metered like every other OpenAI call (image modality).
//
// Mirrors the hero path in lib/builder/generateDemoSite.ts (same bucket + upload +
// meterLLMCall shape); kept separate so it takes a RebuildSpec, not a DemoSpec.

import { getOpenAI } from '@/lib/ai/openaiClient';
import { createClient } from '@supabase/supabase-js';
import { meterLLMCall } from '@/lib/ai/meter';
import { NO_PEOPLE_NO_TEXT_CLAUSE } from '@/lib/images/noPeople';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';

const ROUTE = '/api/rebuild';
const HERO_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';

/** Env flag: off by default (image gen is ~20s + the priciest call). */
export function rebuildHeroEnabled(): boolean {
  const v = String(process.env.REBUILD_HERO_ENABLED ?? '').toLowerCase();
  return v === '1' || v === 'true';
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

function uuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

function slugify(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'rebuild';
}

/** Prompt for the hero image (exported for testing / prompt tuning).
 *
 *  The no-people clause is NOT optional here. This path auto-builds sites for real,
 *  named businesses from their public listing, so a generated photo of staff or diners
 *  would assert people who don't exist on a page that presents as that business's own.
 *  See lib/images/noPeople.ts for why, and the mesh standard it implements.
 *
 *  ⚠️ THE BUSINESS NAME IS DELIBERATELY ABSENT, AND REMOVING IT IS WHAT MAKES THE
 *  NO-LETTERING CLAUSE WORK.
 *
 *  This prompt used to say `a ${industryLabel} business named "${businessName}"`, and the
 *  clause asking for clean unmarked surfaces lost every time: a sweep on 2026-08-14
 *  regenerated 21 heroes with the name in the prompt and got a big painted sign on
 *  21 OF 21. Naming a business and then asking for no lettering is a contradiction, and
 *  the name wins. Worse, the model spells whatever string it is handed — those 21 came
 *  back reading "ARAB-TOWING", "desmoines-towing", "PLUMBING-1", because the name the
 *  caller had was the slug.
 *
 *  Controlled check, same clause and model, name removed: the building's sign came back
 *  BLANK. So the rule is not "add a stronger no-text clause", it is DO NOT PUT A NAME IN
 *  AN IMAGE PROMPT. `industryLabel` already carries everything the model needs to compose
 *  the scene, and the business's real name belongs in the page copy, where it is spelled
 *  by us and not by an image model. */
export function heroPrompt(spec: RebuildSpec): string {
  return (
    `Professional website hero photo for a ${spec.industryLabel} business. ` +
    `Real-world, high quality, on-brand, bright and inviting. ` +
    NO_PEOPLE_NO_TEXT_CLAUSE
  );
}

/**
 * Generate + store a fresh hero for a rebuilt draft. Returns a public URL, or null
 * on any failure (caller falls back to the scraped image). Best-effort by design.
 */
export async function generateRebuildHero(spec: RebuildSpec, userId: string | null): Promise<string | null> {
  try {
    const dataUrl = await meterLLMCall<string | null>(
      { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', user_id: userId, route: ROUTE },
      async () => {
        const openai = getOpenAI('image');
        const gen = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: heroPrompt(spec),
          size: '1536x1024',
          quality: 'medium',
        });
        const b64 = gen.data?.[0]?.b64_json;
        return { value: b64 ? `data:image/png;base64,${b64}` : null, usage: { images: 1 } };
      },
    );
    if (!dataUrl) return null;

    const [, b64] = dataUrl.split(',');
    const buffer = Buffer.from(b64, 'base64');
    const db = admin();
    const path = `rebuild/${slugify(spec.businessName)}/hero/${uuid()}.png`;
    const { error } = await db.storage.from(HERO_BUCKET).upload(path, buffer, {
      contentType: 'image/png',
      upsert: true,
    });
    if (error) return null;
    const { data } = db.storage.from(HERO_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch {
    return null;
  }
}
