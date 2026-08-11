// lib/verbatim/exportProfile.ts
//
// A Verbatim profile as ONE self-contained HTML file the person keeps.
//
// ⚠️ WHY THIS EXISTS, AND IT IS NOT A CONVENIENCE FEATURE. The mesh's test for whether a service
// belongs in a public library (crosstalk 2026-08-04, three sessions) reduced to: is this useful to
// the person if they never become a customer? Verbatim was argued to pass because it hands over an
// ARTEFACT rather than creating a DEPENDENCY — a page you keep, versus a live site that is a
// standing bet on us still existing.
//
// That argument was false when it was made. Until this file, Verbatim produced only a draft
// template on our platform: if QuickSites went away, the person had nothing. The claim was a true
// observation (the parser is deterministic and invents nothing) welded to an unchecked inference
// (therefore they leave with something), which is precisely the failure CLAUDE.md §9 is about.
// So: build the artifact, then the claim is true.
//
// Three properties are load-bearing, not stylistic:
//
//   1. **Self-contained.** Inline CSS, no fonts, no images, no scripts, no network of any kind.
//      It has to open from a USB stick in ten years on a machine that has never heard of us.
//   2. **No branding, no tracking, no link back to us.** It is their employment history. A
//      "made with" badge on a document someone sends to a hiring manager is us advertising
//      through their job search — the exact "borrowed trust" failure the library thread warned
//      about, aimed at a person rather than an institution.
//   3. **Prints.** A library job-help session ends at a printer more often than at a URL.
//
// ⚠️ And it inherits the parser's honesty: what the résumé did not yield is NOT filled in. The
// gaps are rendered as a visible note in the browser and hidden from print (see the @media rule),
// so the person sees what is missing while editing and a hiring manager never sees a document
// annotated with its own holes.

import type { ProfileSpec } from '@/lib/rebuild/importProfile';

/** Minimal HTML escape. Everything interpolated below goes through this — the input is a
 *  stranger's résumé text, and it lands in a file they will send to other people. */
export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * A filename that is safe on every OS and still recognisable.
 * Falls back to "profile" rather than to an empty or hidden filename.
 */
export function exportFilename(name: string | null | undefined): string {
  const base = (name ?? '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 60);
  return `${base || 'profile'}.html`;
}

const GAP_LABEL: Record<string, string> = {
  name: 'your name',
  headline: 'a title for yourself',
  summary: 'a summary',
  skills: 'skills',
  experience: 'work history',
  location: 'where you are',
  links: 'links to your work',
};

/**
 * Render the profile as a standalone document.
 *
 * Pure: same input, same bytes. That matters more than it sounds — it means the export can be
 * regenerated from the same résumé text at any time without us having stored anything, which is
 * why this needs no database row and works for someone who never signs up.
 */
export function exportProfileHtml(profile: ProfileSpec, gaps: string[] = []): string {
  const name = profile.name?.trim() || null;
  const title = name ? `${name}` : 'Profile';

  const rows: string[] = [];

  if (profile.headline) rows.push(`<p class="headline">${esc(profile.headline)}</p>`);

  const meta: string[] = [];
  if (profile.location) meta.push(esc(profile.location));
  if (profile.email) meta.push(`<a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>`);
  if (meta.length) rows.push(`<p class="meta">${meta.join(' &middot; ')}</p>`);

  if (profile.links?.length) {
    const links = profile.links
      .map((l) => `<a href="${esc(l.href)}">${esc(l.label || l.href)}</a>`)
      .join(' &middot; ');
    rows.push(`<p class="meta">${links}</p>`);
  }

  if (profile.bio) rows.push(`<section><h2>About</h2><p>${esc(profile.bio)}</p></section>`);

  if (profile.skills?.length) {
    const items = profile.skills.map((s) => `<li>${esc(s)}</li>`).join('');
    rows.push(`<section><h2>Skills</h2><ul class="skills">${items}</ul></section>`);
  }

  if (profile.experience?.length) {
    // ⚠️ NO EMPTY <h3>. A role the parser could not attribute has heading: '' — real, and it
    // happens on a line like "Various contract work, 2020". Emitting the tag anyway renders a
    // blank heading, which reads as a broken document rather than an unlabelled entry. (This is
    // belt-and-braces: parseExperience no longer manufactures headingless entries from
    // description lines, which is where the four blank headings came from.)
    const items = profile.experience
      .map(
        (r) =>
          `<div class="role">${r.heading ? `<h3>${esc(r.heading)}</h3>` : ''}<p>${esc(
            r.body,
          )}</p></div>`,
      )
      .join('');
    rows.push(`<section><h2>Experience</h2>${items}</section>`);
  }

  // The honest half, and it is deliberately not printed. See the header.
  const gapNote = gaps.length
    ? `<aside class="gaps"><strong>Not found in what you pasted:</strong> ${esc(
        gaps.map((g) => GAP_LABEL[g] ?? g).join(' · '),
      )}. Nothing was invented to fill these — add them yourself if you want them here.</aside>`
    : '';

  // Light-scheme document on purpose: this is a printable personal record, not app chrome, and
  // it must be legible on paper. `color-scheme: only light` stops a dark-mode browser inverting
  // it into something that prints as a black page.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: only light; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto; padding: 3rem 1.5rem; max-width: 42rem;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1a1a1a; background: #fff;
  }
  h1 { font-size: 2rem; margin: 0 0 .25rem; letter-spacing: -.02em; }
  h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .08em; color: #666;
       margin: 2rem 0 .5rem; border-bottom: 1px solid #e5e5e5; padding-bottom: .25rem; }
  h3 { font-size: 1rem; margin: 1.1rem 0 .15rem; }
  p { margin: 0 0 .6rem; }
  .headline { font-size: 1.1rem; color: #333; }
  .meta { font-size: .9rem; color: #555; }
  a { color: #1a4fa0; }
  ul.skills { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .4rem; }
  ul.skills li { border: 1px solid #ddd; border-radius: 999px; padding: .15rem .6rem; font-size: .875rem; }
  .role p { color: #333; white-space: pre-line; }
  .gaps { margin-top: 2.5rem; padding: .75rem 1rem; border-left: 3px solid #d8b400;
          background: #fdf8e6; font-size: .875rem; color: #4a4a4a; }
  @media print {
    body { padding: 0; max-width: none; }
    .gaps { display: none; }      /* editing note, not part of the document they send */
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<h1>${esc(name ?? 'Profile')}</h1>
${rows.join('\n')}
${gapNote}
</body>
</html>
`;
}
