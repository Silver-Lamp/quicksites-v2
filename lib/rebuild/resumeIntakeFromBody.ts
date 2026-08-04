// lib/rebuild/resumeIntakeFromBody.ts
//
// One request body → one ResumeIntake, shared by both Verbatim front doors.
//
// ⚠️ WHY THIS IS EXTRACTED RATHER THAN COPIED. There are now two routes that turn the same posted
// résumé into the same parse: /api/rebuild/resume (creates a draft) and /api/verbatim/export
// (returns a file, stores nothing). They must read the body IDENTICALLY, or the same paste yields
// a page and a download that disagree — and the one that drifts is the one nobody is looking at
// while editing the other. This repo has been bitten by two-copies-of-one-truth twice already
// (`blocks` vs `content_blocks`; the scaffold's services winning over a block's own content),
// both times silently, so the seam gets a module rather than a comment.
//
// The caps are part of the contract, not an implementation detail: a 40k character bound on a CV
// (a long one is ~10k) and 2k on the free-text paragraph.

import type { ProfileLink } from '@/lib/rebuild/importProfile';
import type { ResumeIntake } from '@/lib/rebuild/importResume';

export const MAX_RESUME_CHARS = 40_000;
export const MAX_PARAGRAPH_CHARS = 2_000;

/**
 * Links the person typed. Anything without a usable scheme is dropped rather than coerced —
 * a bare "linkedin.com/in/x" becomes a broken relative link in an exported file that someone
 * emails to a hiring manager, which is worse than the link simply not being there.
 */
export function sanitizeLinks(raw: unknown): ProfileLink[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((l: any) => ({ label: String(l?.label ?? '').trim(), href: String(l?.href ?? '').trim() }))
    .filter((l) => l.href && /^(https?:\/\/|mailto:|tel:)/i.test(l.href))
    .slice(0, 12);
}

const cap = (v: unknown, n: number): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, n) : undefined;
};

/** Map a posted body to the parser's intake. Never throws; validity is the caller's business. */
export function resumeIntakeFromBody(body: any): ResumeIntake {
  return {
    resumeText: String(body?.resumeText ?? '').slice(0, MAX_RESUME_CHARS),
    sinceParagraph: cap(body?.sinceParagraph, MAX_PARAGRAPH_CHARS),
    name: cap(body?.name, 120),
    headline: cap(body?.headline, 160),
    location: cap(body?.location, 120),
    email: cap(body?.email, 160),
    links: sanitizeLinks(body?.links),
  };
}

/** The one length rule both front doors apply, so "too short" means the same thing on each. */
export function resumeTooShort(intake: ResumeIntake): boolean {
  return intake.resumeText.trim().length < 40;
}
