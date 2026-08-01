// lib/rebuild/importResume.ts
//
// A second front door to the About-Me pipeline: paste your résumé + a paragraph about what
// you've done since, and get the same ProfileSpec that importProfile builds from a URL.
//
// The rest is already built — ProfileSpec → rebuildSpecFromProfile → buildRebuildTemplate →
// the `personal` audio-forward scaffold. This module only has to produce a good ProfileSpec.
//
// ⚠️ DELIBERATELY DETERMINISTIC — NO MODEL CALL. importProfile's whole character is that the
// bio is the person's own words, scraped not written. A résumé is even more clearly theirs, and
// this is a CV: a fabricated line in someone's employment history is a different order of wrong
// from a fabricated line in marketing copy. So this parser only ever RECOGNISES and REARRANGES
// text the person supplied. It never fills a gap.
//
// ⚠️ AND IT IS DELIBERATELY MODEST. Résumés have no schema — every one is laid out differently,
// and a parser that tries hard produces confident nonsense on the ones it misreads. This
// recognises the headings people actually use and puts everything it is unsure about into the
// summary, where the person will see it and can fix it in the editor. Under-parsing costs an
// edit; over-parsing invents a job history.

import type { ProfileSpec, ProfileLink } from '@/lib/rebuild/importProfile';

export type ResumeIntake = {
  /** The résumé, pasted as text. */
  resumeText: string;
  /** "What I've done since" — the one paragraph in their own voice. */
  sinceParagraph?: string;
  /** Optional overrides — the person knows their own name better than a parser does. */
  name?: string;
  headline?: string;
  location?: string;
  email?: string;
  /** Extra links they typed (past work, socials). */
  links?: ProfileLink[];
};

/** Headings people actually write, mapped to what we do with the block beneath them. */
const SECTION_PATTERNS: Array<{ key: 'summary' | 'skills' | 'experience'; re: RegExp }> = [
  { key: 'summary', re: /^(summary|profile|about|objective|professional summary)\b/i },
  { key: 'skills', re: /^(key skills|skills|technologies|tech stack|expertise|competencies)\b/i },
  {
    key: 'experience',
    re: /^(experience|recent experience|work experience|employment|featured|roles|history|career)\b/i,
  },
];

const EMAIL_RX = /[\w.+-]+@[\w-]+\.[\w.]+/;
const URL_RX = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,;]*)?)/gi;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const isBlank = (s: string) => !s.trim();

/** Split a line of comma/·/pipe-separated skills into individual entries. */
function splitList(line: string): string[] {
  // Strip a leading category label: real résumés write "Mobile: React Native · Expo", and
  // without this the first skill in every row carries the category glued to it.
  const body = line.replace(/^[A-Za-z][\w &/+-]{0,24}:\s*/, '');
  return body
    .split(/[·|•,;]|\s+\/\s+/)
    .map((s) => clean(s).replace(/^[-–—*]\s*/, ''))
    .filter((s) => s.length > 1 && s.length < 60);
}

/**
 * Group the résumé into the sections we recognise.
 * Anything before the first recognised heading, or under one we don't know, becomes summary —
 * visible to the person rather than silently dropped.
 */
function sectionise(text: string): Record<'summary' | 'skills' | 'experience', string[]> {
  const out = { summary: [] as string[], skills: [] as string[], experience: [] as string[] };
  let current: 'summary' | 'skills' | 'experience' = 'summary';

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^[#*\s]+/, '').trimEnd();
    // ⚠️ A BLANK LINE IS CONTENT, NOT NOISE. Dropping it used to flatten a two-paragraph summary
    // into one run-on block — an editorial change to text we promised only to rearrange. Record
    // it as a paragraph break; consumers that don't care (skills, roles) filter it out.
    if (isBlank(line)) {
      const cur = out[current];
      if (cur.length && cur[cur.length - 1] !== '') cur.push('');
      continue;
    }

    // A heading is short and matches a known word — "Skills" is a heading, a sentence
    // beginning "Skills I picked up along the way…" is not.
    const bare = line.replace(/[:—–-]+\s*$/, '').trim();
    const hit = bare.length <= 40 ? SECTION_PATTERNS.find((p) => p.re.test(bare)) : undefined;
    if (hit) {
      current = hit.key;
      continue;
    }
    out[current].push(line.trim());
  }
  return out;
}

/** Links they typed, plus any bare domains found in the résumé itself. */
function collectLinks(text: string, provided: ProfileLink[] = []): ProfileLink[] {
  const seen = new Set(provided.map((l) => l.href.replace(/^https?:\/\//, '').replace(/\/$/, '')));
  const links: ProfileLink[] = [...provided];
  for (const m of text.matchAll(URL_RX)) {
    const raw = m[1];
    if (EMAIL_RX.test(raw)) continue; // an email is contact, not a link
    const bare = raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (bare.split('.').length < 2 || seen.has(bare)) continue;
    seen.add(bare);
    links.push({ label: bare, href: raw.startsWith('http') ? raw : `https://${raw}` });
  }
  return links.slice(0, 12);
}

/**
 * Résumé + paragraph → the same ProfileSpec importProfile produces from a URL.
 *
 * The "since" paragraph leads the summary on purpose: it is the most current thing about the
 * person and the only part written for this page rather than lifted from a document that may
 * be years old.
 */
export function profileFromResume(intake: ResumeIntake): ProfileSpec {
  const text = String(intake.resumeText ?? '');
  const s = sectionise(text);

  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => !isBlank(l)) ?? '';
  // ⚠️ Strip the title BEFORE length-checking. A real CV's first line is usually
  // "Name — Senior Thing · Other Thing", which blew past a 60-char limit and returned NULL for
  // the person's own name. Judge the candidate, not the line it arrived on.
  const nameCandidate = firstLine.replace(/\s*[—–|]\s*.*$/, '').trim();
  // ⚠️ A SECTION HEADING IS NOT A PERSON. Plenty of résumés open straight onto "Skills" or
  // "Summary" — the name lives in a header, a logo, or an image the extractor can't read. Taking
  // the first line on faith then produced an About-Me page for someone called "Skills", which is
  // exactly the confidently-wrong-name failure this parser is supposed to refuse to make.
  // Found by the PDF round-trip tests; it was always reachable from a pasted résumé too.
  const looksLikeHeading = SECTION_PATTERNS.some((p) => p.re.test(nameCandidate));
  // Still refuse when it doesn't look like a name — a wrong name on an About-Me page is the
  // worst possible first impression, and blank is honest.
  const guessedName =
    nameCandidate &&
    !looksLikeHeading &&
    nameCandidate.length <= 60 &&
    !EMAIL_RX.test(nameCandidate) &&
    !/\d/.test(nameCandidate)
      ? nameCandidate
      : null;

  const email = intake.email || text.match(EMAIL_RX)?.[0] || null;

  const since = clean(intake.sinceParagraph ?? '');

  // ⚠️ THE NAME LINE IS NOT A BIOGRAPHY. sectionise files everything above the first recognised
  // heading under `summary`, and on almost every résumé that includes the name line itself. Left
  // in, a CV that is just "Jo Mensah" + a skills list produced an About-me block whose entire
  // body was "Jo Mensah" — the page telling you who someone is by repeating their name back at
  // you. Worse, it made `bio` non-null, so `gaps` reported a summary we did not actually have
  // and the person was never told to write one.
  const summaryLines = s.summary.slice();
  if (guessedName && (summaryLines[0] ?? '').trim() === firstLine) summaryLines.shift();

  // ⚠️ CONTACT DETAILS ARE NOT A BIOGRAPHY. Résumés put the email/phone/site directly under the
  // name, above any heading, so sectionise files them under `summary` — and a real run opened
  // someone's About-me with "priya@example.com Product designer with eleven years...". The
  // address is already captured as contact; here it is just debris in a sentence about them.
  const isContactOnly = (l: string) => {
    const t = l.trim();
    if (!t) return false;
    const stripped = t
      .replace(EMAIL_RX, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\+?[\d][\d\s().-]{6,}\d/g, '')
      .replace(/[·|,;•\-–—]/g, '')
      .trim();
    return stripped.length === 0;
  };

  // Rebuild paragraphs: consecutive lines are one paragraph, blanks separate them.
  const paragraphs: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const joined = buf.map(clean).filter(Boolean).join(' ').trim();
    if (joined) paragraphs.push(joined);
    buf = [];
  };
  for (const l of summaryLines) {
    if (l === '') flush();
    else if (!isContactOnly(l)) buf.push(l);
  }
  flush();
  const summaryBody = paragraphs.join('\n\n');
  const bio = [since, summaryBody].filter(Boolean).join('\n\n') || null;

  const skills = s.skills.filter(Boolean).flatMap(splitList);

  // Experience keeps its own line breaks — each line is a role, and flattening them into a
  // paragraph would blur employers together.
  const experience = s.experience
    .filter(Boolean)
    .map(clean)
    .filter(Boolean)
    .map((line) => {
      const [head, ...rest] = line.split(/\s+[—–]\s+/);
      return rest.length
        ? { heading: clean(head), body: clean(rest.join(' — ')) }
        : { heading: '', body: line };
    });

  return {
    name: intake.name?.trim() || guessedName,
    headline: intake.headline?.trim() || null,
    // No photo. A résumé rarely carries one and we never invent an image of a person.
    photoUrl: null,
    bio,
    location: intake.location?.trim() || null,
    links: collectLinks(text, intake.links),
    ...(skills.length ? { skills: skills.slice(0, 40) } : {}),
    ...(experience.length ? { experience: experience.slice(0, 20) } : {}),
    ...(email ? { email } : {}),
  } as ProfileSpec;
}
