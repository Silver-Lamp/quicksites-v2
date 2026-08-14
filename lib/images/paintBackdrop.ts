// lib/images/paintBackdrop.ts
//
// The ONE backdrop style that costs money: a generated painting behind a site.
// Implements crosstalk/contracts/painterly-backdrop.md. Every rule it touches is called
// out inline so a future edit can't drop one by accident.
//
//  1. server-side only key    — getOpenAI('image'), never NEXT_PUBLIC_*
//  2. owner/admin-triggered   — the only caller is an admin route, one site per call.
//                               NEVER wire this into site creation or a batch runner.
//  3. deterministic path      — backdrops/site/<templateId>.png, upsert:true → a repaint
//                               overwrites, and the `?v=<ts>` is PERSISTED with the URL
//                               (storing a bare path and appending ?v at render time
//                               defeats the cache-bust — see the rule 3 callout).
//  4. cost recorded           — meterLLMCall, modality 'image' (LLM_METERING.md)
//  5. prompt owned by us      — no shared prompt; ours is below
//  6. gpt-image-1             — the network standard model
//  7. degrades to plain       — returns null on any failure; the caller leaves the
//                               backdrop unset and the site renders exactly as before
//  9. no people               — NO_PEOPLE_CLAUSE, the same constant the hero paths use

import { getOpenAI } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { NO_PEOPLE_NO_TEXT_CLAUSE } from '@/lib/images/noPeople';
import { readBackdrop, type SiteBackdrop } from '@/lib/theme/backdrops';
import { republishIfPublished } from '@/lib/templates/republishIfPublished';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';
const ROUTE = 'lib/images/paintBackdrop';

/** Rule 5: our prompt, our palette, our placement. Rule 9 is not optional. */
export function backdropPrompt(opts: { industryLabel?: string | null; subject?: string | null }): string {
  const subject =
    (opts.subject && opts.subject.trim()) ||
    (opts.industryLabel ? `an environment suggesting a ${opts.industryLabel} business` : 'a calm abstract environment');

  return (
    `A soft, painterly background image for a website — ${subject}. ` +
    `Loose impressionistic brushwork, muted and atmospheric, gentle light, plenty of open ` +
    `negative space in the middle where text will sit. It must read as a distant backdrop, ` +
    `not a photograph and not a focal illustration: low contrast, nothing sharp or busy, ` +
    `no central subject competing with foreground text. ` +
    // ⚠️ NO_TEXT IS LOAD-BEARING HERE, and the version without it shipped painted signage.
    // A 2026-08-14 pool run produced a pest_control backdrop with "PEST CONTROL" lettered on a
    // signboard — the INDUSTRY LABEL in the prompt summons a sign exactly the way a business
    // name does on the hero paths (see lib/rebuild/generateHero.ts). Lettering is worse on a
    // backdrop than on a hero: it sits behind a real business's copy, so the page appears to be
    // making a claim in signage the owner never wrote, and it is the one thing in an
    // "atmospheric, low contrast" image that the eye goes straight to.
    NO_PEOPLE_NO_TEXT_CLAUSE
  );
}

/**
 * Paint ONE image into an industry's shared pool (lib/theme/backdropPool.ts).
 *
 * Unlike paintSiteBackdrop this touches no template — it only produces a reusable asset,
 * so many sites can share it at zero marginal cost. `upsert:false` so a re-run can't
 * silently overwrite an existing pool member and charge for the privilege.
 *
 * Returns true only if an image was generated AND stored.
 */
export async function paintPoolImage(
  industryKey: string,
  path: string,
  actorId: string | null,
): Promise<boolean> {
  const prompt = backdropPrompt({ industryLabel: industryKey.replace(/_/g, ' '), subject: null });
  try {
    const dataUrl = await meterLLMCall<string | null>(
      { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', user_id: actorId, route: `${ROUTE}#pool` },
      async () => {
        const openai = getOpenAI('image');
        const gen = await openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          size: '1536x1024',
          quality: 'medium',
        });
        const b64 = gen.data?.[0]?.b64_json;
        return { value: b64 ? `data:image/png;base64,${b64}` : null, usage: { images: 1 } };
      },
    );
    if (!dataUrl) return false;
    const [, b64] = dataUrl.split(',');
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(b64, 'base64'), { contentType: 'image/png', upsert: false });
    return !error;
  } catch {
    return false;
  }
}

export type PaintBackdropResult = {
  changed: boolean;
  reason?: string;
  url?: string;
  style?: string;
  /** True when the live (published) site was refreshed too — see republishIfPublished. */
  republished?: boolean;
  warning?: string;
};

/**
 * Generate + store a painterly backdrop for one site and persist it on the template.
 * Best-effort by design: any failure returns `changed:false` and leaves the site's
 * existing backdrop untouched (rule 7 — never make the page worse).
 */
export async function paintSiteBackdrop(
  templateId: string,
  actorId: string | null,
  opts: { subject?: string | null; intensity?: number } = {},
): Promise<PaintBackdropResult> {
  const { data: tpl, error } = await supabaseAdmin
    .from('templates')
    .select('id, rev, industry, published, data')
    .eq('id', templateId)
    .maybeSingle();

  if (error || !tpl) return { changed: false, reason: 'not_found' };

  const industryLabel =
    (tpl as any)?.data?.meta?.industry_label ?? (tpl as any)?.industry ?? null;
  const subject = opts.subject ?? readBackdrop(tpl)?.subject ?? null;
  const prompt = backdropPrompt({ industryLabel, subject });

  // Rule 4: metered like every other inference call. Rule 6: gpt-image-1, sized to a wide
  // canvas since this sits behind a full page.
  let dataUrl: string | null = null;
  try {
    dataUrl = await meterLLMCall<string | null>(
      { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', user_id: actorId, route: ROUTE },
      async () => {
        const openai = getOpenAI('image');
        const gen = await openai.images.generate({
          model: 'gpt-image-1',
          prompt,
          size: '1536x1024',
          quality: 'medium',
        });
        const b64 = gen.data?.[0]?.b64_json;
        return { value: b64 ? `data:image/png;base64,${b64}` : null, usage: { images: 1 } };
      },
    );
  } catch (e: any) {
    return { changed: false, reason: 'generate_failed', ...(e?.message ? { error: e.message } : {}) } as PaintBackdropResult;
  }
  if (!dataUrl) return { changed: false, reason: 'no_image' };

  // Rule 3: deterministic path per entity + upsert, so a repaint overwrites in place
  // rather than accumulating orphaned objects.
  const [, b64] = dataUrl.split(',');
  const buffer = Buffer.from(b64, 'base64');
  const path = `backdrops/site/${templateId}.png`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true });
  if (upErr) return { changed: false, reason: 'upload_failed' };

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  const base = pub?.publicUrl;
  if (!base) return { changed: false, reason: 'no_public_url' };

  // Rule 3, the part that's easy to get wrong: the cache-bust is PERSISTED with the URL.
  // Overwriting at a fixed path means the CDN would keep serving the old bytes to anyone
  // re-deriving the bare URL, so the new ?v must be written into the stored value.
  const url = `${base}?v=${Date.now()}`;

  const backdrop: SiteBackdrop = {
    style: 'painterly',
    url,
    subject: subject ?? null,
    intensity: opts.intensity ?? readBackdrop(tpl)?.intensity ?? 50,
    auto: false, // an owner paid for this — the fleet upgrade must never overwrite it
  };

  const data = ((tpl as any).data ?? {}) as Record<string, any>;
  const commitErr = await commitTemplatePatch(
    templateId,
    (tpl as any).rev ?? 0,
    { data: { ...data, meta: { ...(data.meta ?? {}), backdrop } } },
    actorId,
  );
  if (commitErr) return { changed: false, reason: 'commit_failed' };

  // A published site serves a SNAPSHOT, not templates.data — without this the paint is
  // invisible on the live page. Guarded: never takes an unpublished draft live.
  const republish = await republishIfPublished(templateId, (tpl as any).published);

  return { changed: true, url, style: 'painterly', ...republish };
}
