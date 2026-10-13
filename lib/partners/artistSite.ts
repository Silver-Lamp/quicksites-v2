// lib/partners/artistSite.ts
//
// HiveJournal → QuickSites artist-site handoff (crosstalk/contracts/artist-profile.md, AGREED
// 2026-10-13). HJ POSTs a signed artist profile from the artist's own HJ dashboard — only for an
// artist who has signed with Perfect Loops and claimed their HJ page — and we build a draft
// from the `musician` scaffold, owned by the operator until the artist claims it with a link
// WE mint (a token minted off the verifying server reads "expired").
//
// ⚠️ ONLY WHAT THE PROFILE SAYS. The scaffold seeds the player, a releases index, a shows list
// and a gallery EMPTY; this fills the hero (name, photo), the player (embed + fan link + their
// platform links) and an About block with their bio. No invented shows, no invented releases,
// no services, no FAQ, no testimonials — the scaffold's speaking blocks never reach an artist
// page (test-pinned).
//
// ⚠️ `claim_source='operator_draft'`, not a new value: that is what the public pre-claim render
// (`isPublicPreClaimDraft`) and the claim RPC (`20260821`) already accept, and the claim publishes
// the site (`activateClaimedSite` → `publish_template`). The HJ provenance lives in
// `data.meta.hj_handoff`, which is also the idempotency key: one slug, one draft.
import { z } from 'zod';
import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { mintSiteClaimToken, SITE_CLAIM_TTL_MS } from '@/lib/auth/siteClaimToken';
// ⚠️ From the plain module, never from the renderer (a 'use client' file): see perfectLoopsUrls.ts.
import { isAllowedEmbedUrl, isAllowedFanLink } from '@/lib/partners/perfectLoopsUrls';

const https = z.string().url().refine((u) => u.startsWith('https://'), 'https only');

export const ArtistProfileSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'slug: lowercase letters, digits, hyphens'),
  name: z.string().trim().min(1).max(120),
  bio: z.string().trim().max(4000).optional().default(''),
  image_url: https.optional().or(z.literal('')).default(''),
  links: z
    .array(z.object({ platform: z.string().trim().max(40).default('other'), url: https }))
    .max(12)
    .optional()
    .default([]),
  loops: z.array(z.object({ id: z.string().max(80), title: z.string().max(200).optional().default(''), duration_sec: z.number().optional() })).max(200).optional().default([]),
  hj_page_url: https,
  fan_link_url: https.refine(isAllowedFanLink, 'fan_link_url must be a perfectloops.fm or hivejournal.com URL'),
  player_embed_url: https.refine(isAllowedEmbedUrl, 'player_embed_url must be a hivejournal.com URL'),
});
export type ArtistProfile = z.infer<typeof ArtistProfileSchema>;

/**
 * Pure. `X-Partner-Signature` = hex HMAC-SHA256 of the RAW request body with the shared
 * PARTNER_QUICKSITES_SECRET (the same secret as partner-provisioning.md). Constant-time compare;
 * any shape mismatch is simply false.
 */
export function verifyPartnerSignature(rawBody: string, signature: string | null, secret: string | undefined): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const given = signature.trim().toLowerCase().replace(/^sha256=/, '');
  if (given.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(given, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function signPartnerBody(rawBody: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

/** Pure: the profile → a template payload (the row minus ids). */
export function assembleArtistTemplate(p: ArtistProfile) {
  const tpl: any = buildIndustryStarter({ businessName: p.name, industryKey: 'musician' });
  const firstLine = p.bio.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  // ⚠️ `blocks` and `content_blocks` are the SAME array on a scaffolded page (industryScaffold
  // builds `{ content_blocks: blocks, blocks }`). Walking both keys and inserting into each put
  // the About block in twice, and the first live House Band draft rendered it twice. Insert
  // once per distinct array; walk both keys only for in-place edits, which are idempotent.
  const inserted = new Set<unknown[]>();
  for (const pg of tpl.data?.pages ?? []) {
    for (const key of ['blocks', 'content_blocks'] as const) {
      if (!Array.isArray(pg[key])) continue;
      for (const b of pg[key]) {
        for (const c of [b?.content, b?.props]) {
          if (!c) continue;
          if (b.type === 'hero') {
            if (p.image_url) c.image_url = p.image_url;
            if (firstLine && firstLine.length <= 200) c.subheadline = firstLine;
          }
          if (b.type === 'perfect_loops_player') {
            c.artist_name = p.name;
            c.embed_url = p.player_embed_url;
            c.fan_link_url = p.fan_link_url;
            c.links = p.links.map((l) => ({ platform: l.platform, url: l.url }));
          }
        }
      }
      // Their bio, in their words, as an About block after the player. Only when there is one.
      // No block title: the section heading "About <name>" is the only heading, so the page does
      // not read "About / About The Band" stacked.
      if (p.bio && !inserted.has(pg[key])) {
        inserted.add(pg[key]);
        const about: any = createDefaultBlock('story');
        about.content = { ...(about.content ?? {}), title: '', sections: [{ heading: `About ${p.name}`, body: p.bio, image_url: '', cta_text: '', cta_link: '' }] };
        const playerIdx = pg[key].findIndex((b: any) => b?.type === 'perfect_loops_player');
        pg[key].splice(playerIdx >= 0 ? playerIdx + 1 : 1, 0, about);
      }
    }
  }
  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    built_for: p.name,
    hj_handoff: { artist_slug: p.slug, hj_page_url: p.hj_page_url, received_at: new Date().toISOString() },
  };
  return tpl;
}

export type ArtistDraftResult = {
  template_id: string;
  slug: string;
  preview_url: string;
  claim_url: string;
  expires_at: string;
  existing: boolean;
};

/** Find the draft a previous POST for this artist built, if any (idempotent on slug). */
export async function findArtistDraft(artistSlug: string): Promise<{ id: string; slug: string } | null> {
  const { data } = await supabaseAdmin
    .from('templates')
    .select('id, slug')
    .eq('data->meta->hj_handoff->>artist_slug', artistSlug)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { id: string; slug: string } | null) ?? null;
}

export async function buildArtistDraft(p: ArtistProfile, operatorId: string, base: string): Promise<ArtistDraftResult> {
  const b = base.replace(/\/+$/, '');
  const mint = (id: string, slug: string, existing: boolean): ArtistDraftResult => {
    const now = Date.now();
    return {
      template_id: id,
      slug,
      preview_url: `${b}/sites/${slug}`,
      claim_url: `${b}/claim-site/${id}?token=${encodeURIComponent(mintSiteClaimToken(id, now))}`,
      expires_at: new Date(now + SITE_CLAIM_TTL_MS).toISOString(),
      existing,
    };
  };
  const found = await findArtistDraft(p.slug);
  if (found) return mint(found.id, found.slug, true);

  const tpl = assembleArtistTemplate(p);
  let slug = p.slug;
  for (let attempt = 0; attempt < 3; attempt++) {
    const row: Record<string, unknown> = {
      id: globalThis.crypto.randomUUID(),
      template_name: attempt === 0 ? tpl.template_name : `${tpl.template_name} ${attempt + 1}`,
      slug,
      data: tpl.data,
      color_mode: tpl.color_mode,
      header_block: tpl.header_block,
      footer_block: tpl.footer_block,
      is_site: false,
      industry: 'musician',
      business_name: p.name,
      owner_id: operatorId,
      claim_source: 'operator_draft',
    };
    const { data, error } = await supabaseAdmin.from('templates').insert(row).select('id, slug').single();
    if (!error && data) return mint((data as { id: string }).id, (data as { slug: string }).slug, false);
    if (error && `${error.code}` === '23505') {
      slug = `${p.slug}-${Math.random().toString(36).slice(2, 5)}`;
      continue;
    }
    throw new Error(`artist draft insert failed: ${error?.message ?? 'unknown'}`);
  }
  throw new Error('artist draft insert failed: could not allocate a slug');
}
