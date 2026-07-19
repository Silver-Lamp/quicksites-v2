// lib/personas/buildPersonaSite.ts
//
// Assemble an "About Me" draft site for a HiveJournal AI Persona (the cross-product automation
// test — see crosstalk, personas build About-Me sites on QS). Reuses the existing `personal`
// audio-forward scaffold (rebuildSpecFromProfile → buildRebuildTemplate) so there's almost no
// new UI — a persona maps 1:1 onto the profile shape.
//
// HARD GUARDRAIL (agreed with HJ): Personas are FICTIONAL AI characters. Every persona site is
// stamped `is_ai_persona` AND carries a NON-DISMISSIBLE "AI persona — fictional" banner, so it can
// never read as a real person. Voice is a synthetic ASSIGNED audio url (player only) — there is no
// real person, so no voice consent surface. Sites are inserted as DRAFTS; a human approves (publishes)
// before anything hits the public /personas showcase.

import { rebuildSpecFromProfile, type ProfileSpec, type ProfileLink } from '@/lib/rebuild/importProfile';
import { buildRebuildTemplate, type RebuildTemplate } from '@/lib/rebuild/assembleDraft';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

/** The intake shape a HiveJournal Persona (or its agent) sends. */
export type PersonaInput = {
  name: string;
  /** Job/role/one-line tagline → the hero subheadline. */
  tagline?: string;
  /** The "about" text — the persona's own words. */
  bio: string;
  /** Life situation (occupation, core tension, kids…) — appended to the about.
   *  Accepts HJ's `life_situation` alias (their ai_personas field name). */
  situation?: string;
  life_situation?: string;
  /** MBTI type (HJ ai_personas field) — surfaced as a small "Type" line when present. */
  mbti?: string;
  /** Optional flavor woven into the about. */
  leitmotif?: string;
  arc?: string;
  /** Portrait image url (fictional character art). */
  portraitUrl?: string;
  location?: string;
  links?: ProfileLink[];
  /** Assigned SYNTHETIC voice render (an About That / TTS mp3). Player only — never a real clone. */
  audioUrl?: string;
  /** HJ's persona id, for attribution/dedupe. */
  sourceId?: string;
};

function nonEmpty(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** The exact banner text — kept here so the label is consistent + auditable. */
export function personaBannerMessage(name: string): string {
  return `🤖 AI persona — “${name}” is a fictional character created by HiveJournal, not a real person.`;
}

/**
 * Build the draft template payload for a persona's About-Me site. Pure (no I/O) — the route inserts
 * it. Prepends the non-dismissible AI-fictional banner, adds the assigned-voice player when present,
 * and stamps `data.meta.is_ai_persona`.
 */
export function buildPersonaTemplate(p: PersonaInput): RebuildTemplate {
  const name = nonEmpty(p.name) || 'AI Persona';
  const situation = nonEmpty(p.situation) ?? nonEmpty(p.life_situation);
  const mbti = nonEmpty(p.mbti);
  const aboutParts = [
    nonEmpty(p.bio),
    situation,
    nonEmpty(p.arc),
    nonEmpty(p.leitmotif),
    mbti ? `Type: ${mbti}.` : null,
  ].filter(Boolean) as string[];

  const profile: ProfileSpec = {
    name,
    headline: nonEmpty(p.tagline),
    bio: aboutParts.join('\n\n') || null,
    photoUrl: nonEmpty(p.portraitUrl),
    location: nonEmpty(p.location),
    links: Array.isArray(p.links) ? p.links.filter((l) => l && nonEmpty(l.href)) : [],
  };

  const spec = rebuildSpecFromProfile(profile);
  const tpl = buildRebuildTemplate({ spec, heroImage: profile.photoUrl, sourceUrl: null });

  const blocks: any[] = tpl.data?.pages?.[0]?.blocks ?? [];

  // 1) Non-dismissible AI-fictional banner at the very top — the load-bearing guardrail.
  const banner: any = createDefaultBlock('announcement_bar');
  banner.content = {
    ...banner.content,
    message: personaBannerMessage(name),
    link_text: '',
    link_href: '',
    code: '',
    ends_at: '',
    dismissible: false,
  };
  blocks.unshift(banner);

  // 2) Assigned synthetic voice (player only) — insert just after the hero (index 2 now).
  if (nonEmpty(p.audioUrl)) {
    const audio: any = createDefaultBlock('audio');
    audio.content = { ...audio.content, url: p.audioUrl, title: `Hear ${name}`, provider: 'hivejournal' };
    blocks.splice(Math.min(2, blocks.length), 0, audio);
  }

  // 3) Stamp AI-persona provenance (drives the showcase filter + any renderer gating).
  tpl.data = tpl.data ?? {};
  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    is_ai_persona: true,
    persona_source_id: nonEmpty(p.sourceId),
    // noindex until a human approves + publishes (also enforced by is_site=false at draft time).
    robots_noindex: true,
  };

  return tpl;
}
