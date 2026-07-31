// lib/rebuild/buildResumeSite.ts
//
// Résumé intake → an About-Me draft template. Pure (no I/O) — the caller inserts it.
//
// Deliberately thin: profileFromResume already produced the ProfileSpec, and
// rebuildSpecFromProfile → buildRebuildTemplate already turns a ProfileSpec into the `personal`
// audio-forward scaffold. This is the seam that joins them, and it exists so the route stays a
// route (validate, call, insert) rather than accumulating pipeline logic — the same shape as
// buildPersonaSite.
//
// ⚠️ NO ASSIGNED VOICE HERE, unlike the persona builder. A persona is fictional, so a synthetic
// voice needs no consent surface. This is a REAL person's page: any voice on it must be their
// own, via a consented clone, and that is a separate opt-in flow — not something a résumé
// upload silently switches on. See crosstalk/contracts/audio-honesty-standard.md.
import { profileFromResume, type ResumeIntake } from '@/lib/rebuild/importResume';
import { rebuildSpecFromProfile, type ProfileSpec } from '@/lib/rebuild/importProfile';
import { buildRebuildTemplate, type RebuildTemplate } from '@/lib/rebuild/assembleDraft';

export type ResumeSiteResult = {
  /** The parsed spec, returned so the caller can show the person what we read. */
  profile: ProfileSpec;
  template: RebuildTemplate;
  /** Fields the résumé didn't yield — shown to the person, never filled in for them. */
  gaps: string[];
};

/**
 * Build the draft. `gaps` is the honest half of the return: a résumé parser that reports only
 * what it found lets a person publish a page missing their own name without noticing. Telling
 * them what is empty is cheaper than guessing, and it is the difference between a tool that
 * helps and one that quietly speaks for them.
 */
export function buildResumeSite(intake: ResumeIntake): ResumeSiteResult {
  const profile = profileFromResume(intake);

  const gaps: string[] = [];
  if (!profile.name) gaps.push('name');
  if (!profile.headline) gaps.push('headline'); // never inferred — a title is a claim
  if (!profile.bio) gaps.push('summary');
  if (!profile.skills?.length) gaps.push('skills');
  if (!profile.experience?.length) gaps.push('experience');
  if (!profile.location) gaps.push('location');
  if (!profile.links.length) gaps.push('links');

  const spec = rebuildSpecFromProfile(profile);
  const template = buildRebuildTemplate({
    spec,
    // A résumé has no photograph and we never generate one of a person (rule 9). The scaffold
    // handles a missing hero image; an invented face on a real person's page would not be a
    // design shortcut, it would be a lie about who they are.
    heroImage: null,
    sourceUrl: null,
  });

  return { profile, template, gaps };
}
