// lib/images/paintHero.ts
//
// A painterly HERO — the illustrated cousin of the painterly backdrop.
//
// ⚠️ A HERO IS NOT A BACKDROP, AND THE PROMPT MUST NOT PRETEND OTHERWISE. The backdrop prompt
// asks for something deliberately weak: low contrast, no focal subject, open negative space in
// the middle, "a distant backdrop, not a focal illustration". That is right for a layer sitting
// behind a whole page and wrong for a hero, which is the one image a visitor actually looks at.
// Reusing backdropPrompt here would produce a washed-out nothing at the top of every stand.
//
// So this asks for a real illustration — a subject, warmth, depth — while keeping the two
// constraints that are not negotiable:
//
//   • NO PEOPLE (rule 9, lib/images/noPeople.ts). These sites are built for real, named
//     sellers; a painted child at a lemonade stand asserts a person who does not exist on a
//     page presenting as that family's own.
//   • NO LETTERING. This repo has shipped invented signage twice — "PEST CONTROL" on a backdrop
//     and "EUGENE PRÈSSURE WASHING" on a hero — and a lemonade stand is the single most likely
//     subject in the whole fleet to summon a painted "LEMONADE" sign. A misspelt or invented
//     word on a real seller's page is worse than a plain photo.
//
// Cost: ~$0.04 per image, gpt-image-1 at 'medium'. This is why heroes come from a per-industry
// POOL (lib/theme/heroPool.ts) rather than being painted per site: a vertical pays once for N
// images and every site after that is free and instant.

import { getOpenAI } from '@/lib/ai/openaiClient';
import { meterLLMCall } from '@/lib/ai/meter';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NO_PEOPLE_NO_TEXT_CLAUSE } from '@/lib/images/noPeople';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { republishIfPublished } from '@/lib/templates/republishIfPublished';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'templates';
const ROUTE = 'lib/images/paintHero';

/**
 * Per-industry subjects. Written as SCENES, not as businesses.
 *
 * "a lemonade stand" invites a signboard; "a wooden table on a summer lawn with a glass pitcher"
 * describes the same picture with nothing for the model to letter. Naming the object instead of
 * the business is the cheapest defence against invented signage there is, and it survives a
 * model change in a way that a scolding clause does not.
 */
const HERO_SUBJECTS: Record<string, string> = {
  lemonade_stand:
    'a simple wooden table on a sunlit summer lawn, a glass pitcher of lemonade and stacked paper cups, ' +
    'sliced lemons on a board, dappled shade from a tree overhead',
  garage_sale:
    'a suburban driveway on a bright weekend morning, folding tables of assorted household objects, ' +
    'stacked books and crockery, a bicycle leaning on a fence, long morning shadows',
  yard_sale:
    'a front yard on a clear morning, trestle tables of secondhand treasures, a quilt over a chair, ' +
    'boxes of records and glassware, soft grass and hedges behind',
  thrift_shop:
    'the interior of a small secondhand shop, rails of clothing, shelves of mismatched china and lamps, ' +
    'warm window light across a worn wooden floor',
};

/** Rule 5: our prompt, our palette, our placement. Rules 9 + no-text are not optional. */
export function heroPrompt(opts: { industryKey?: string | null; industryLabel?: string | null; subject?: string | null }): string {
  const keyed = opts.industryKey ? HERO_SUBJECTS[opts.industryKey] : null;
  const subject =
    (opts.subject && opts.subject.trim()) ||
    keyed ||
    (opts.industryLabel ? `a scene suggesting a ${opts.industryLabel} business` : 'a warm, inviting everyday scene');

  return (
    `A painterly illustrated hero image for a small local website — ${subject}. ` +
    `Loose confident brushwork with visible texture, warm natural light, rich but unsaturated ` +
    `colour, gentle depth of field. It should feel hand-painted and inviting rather than ` +
    `photographic or digital. Wide composition with the subject offset to one side and calmer ` +
    `open area toward the other, so headline text can sit over it comfortably. ` +
    NO_PEOPLE_NO_TEXT_CLAUSE
  );
}

/**
 * Paint ONE image into an industry's shared hero pool (lib/theme/heroPool.ts).
 *
 * Touches no template — it only produces a reusable asset, so many sites share it at zero
 * marginal cost. `upsert:false` so a re-run cannot silently overwrite a pool member and charge
 * for the privilege.
 *
 * Returns true only if an image was generated AND stored.
 */
export async function paintHeroPoolImage(
  industryKey: string,
  path: string,
  actorId: string | null,
): Promise<boolean> {
  const prompt = heroPrompt({ industryKey, industryLabel: industryKey.replace(/_/g, ' ') });
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

export type PaintHeroResult = {
  changed: boolean;
  reason?: string;
  url?: string;
  republished?: boolean;
  warning?: string;
};

/**
 * Repaint ONE site's hero and persist it. Costs ~$0.04 — an owner/admin action, never a
 * request path, and never a sweep.
 *
 * Mirrors paintSiteBackdrop, including the two details that are easy to get wrong:
 *
 *   • Deterministic path + upsert, so a repaint overwrites in place instead of accumulating
 *     orphaned objects — with the cache-bust PERSISTED into the stored URL, because
 *     overwriting at a fixed path leaves the CDN serving the old bytes to anyone who
 *     re-derives the bare URL.
 *   • A republish at the end. A published site serves a SNAPSHOT, not templates.data, so
 *     without it the paint is real in the database and invisible on the live page — which is
 *     precisely the "the write worked and nothing changed" shape that has cost this repo
 *     several debugging cycles. Guarded so it never takes an unpublished draft live.
 *
 * Writes BOTH block shapes it finds, for the reason in lib/menu/menuBlocks.ts: the fleet
 * carries `content` and `props` heroes and the renderer reads whichever it finds first.
 */
export async function paintSiteHero(
  templateId: string,
  actorId: string | null,
  opts: { subject?: string | null } = {},
): Promise<PaintHeroResult> {
  const { data: tpl, error } = await supabaseAdmin
    .from('templates')
    .select('id, rev, industry, data')
    .eq('id', templateId)
    .maybeSingle();
  if (error || !tpl) return { changed: false, reason: 'not_found' };

  const row = tpl as any;
  const industryKey = row.industry ?? row.data?.meta?.industry ?? null;
  const industryLabel = row.data?.meta?.industry_label ?? industryKey ?? null;
  const prompt = heroPrompt({ industryKey, industryLabel, subject: opts.subject ?? null });

  let dataUrl: string | null = null;
  try {
    dataUrl = await meterLLMCall<string | null>(
      { provider: 'openai', model_code: 'gpt-image-1', modality: 'image', user_id: actorId, route: `${ROUTE}#site` },
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
    return { changed: false, reason: 'generate_failed', ...(e?.message ? { warning: e.message } : {}) };
  }
  if (!dataUrl) return { changed: false, reason: 'no_image' };

  const [, b64] = dataUrl.split(',');
  const path = `heroes/site/${templateId}.png`;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, Buffer.from(b64, 'base64'), { contentType: 'image/png', upsert: true });
  if (upErr) return { changed: false, reason: 'upload_failed' };

  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  if (!pub?.publicUrl) return { changed: false, reason: 'no_public_url' };
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const data = JSON.parse(JSON.stringify(row.data ?? {}));
  let touched = false;
  for (const page of Array.isArray(data?.pages) ? data.pages : []) {
    for (const key of ['content_blocks', 'blocks'] as const) {
      if (!Array.isArray(page?.[key])) continue;
      page[key] = page[key].map((b: any) => {
        if (b?.type !== 'hero') return b;
        touched = true;
        const bag = { ...(b.content ?? b.props ?? {}), image_url: url, art_style: 'painterly' };
        return b.content ? { ...b, content: bag } : { ...b, props: bag };
      });
    }
  }
  if (!touched) return { changed: false, reason: 'no_hero_block' };

  const commitErr = await commitTemplatePatch(templateId, row.rev ?? 0, { data }, actorId);
  if (commitErr) return { changed: false, reason: 'commit_failed', warning: commitErr };

  const rep = await republishIfPublished(templateId);
  return { changed: true, url, republished: rep.republished, ...(rep.warning ? { warning: rep.warning } : {}) };
}
