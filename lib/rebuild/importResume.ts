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
  // ⚠️ THE QUALIFIER PREFIX IS LOAD-BEARING. This was `^(key skills|skills|…)`, anchored — so
  // "TECHNICAL SKILLS", which is one of the commonest headings on an engineering CV, did not
  // match and the entire section was dropped. The parser then correctly reported `skills` as a
  // gap, so it never lied; it was simply blind to a heading most of its users write. Found by
  // running a real senior engineer's résumé through it and getting 0 skills from a full page of
  // them.
  {
    key: 'skills',
    re: /^((technical|core|key|professional|relevant|primary|principal|other)\s+)?(skills|technologies|technical proficiencies|tech stack|expertise|competencies)\b/i,
  },
  {
    key: 'experience',
    re: /^(experience|recent experience|work experience|employment|featured|roles|history|career)\b/i,
  },
];

const EMAIL_RX = /[\w.+-]+@[\w-]+\.[\w.]+/;
const EMAIL_RX_G = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const URL_RX = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s,;]*)?)/gi;

/**
 * ⚠️ A BARE DOMAIN NEEDS A REAL TLD, BECAUSE A CV IS FULL OF THINGS SHAPED LIKE ONE.
 *
 * `URL_RX` accepts any `word.word` whose tail is 2+ letters, which is exactly the shape of
 * **Next.js**, **Node.js**, **React.js** and **ASP.NET**. Running a real engineer's résumé through
 * this produced clickable links to `https://Next.js` and `https://Node.js` on a page built to be
 * sent to hiring managers — broken links, labelled with the technologies the person is best at.
 *
 * The allowlist is deliberately short and boring. A TLD missing from it means a real link is
 * dropped, which is recoverable — the person can add it — whereas a false one ships a broken link
 * under their name. Given the choice, drop it.
 */
const KNOWN_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'io', 'dev', 'ai', 'co', 'me', 'app', 'xyz', 'info', 'biz',
  'us', 'uk', 'ca', 'au', 'de', 'fr', 'nl', 'se', 'no', 'jp', 'in', 'eu', 'tech', 'site', 'page',
  'blog', 'design', 'studio', 'agency', 'digital', 'cloud', 'sh', 'gg', 'to', 'ly', 'so', 'is',
]);

function looksLikeRealDomain(bare: string): boolean {
  const host = bare.split('/')[0];
  const parts = host.split('.');
  if (parts.length < 2) return false;
  return KNOWN_TLDS.has(parts[parts.length - 1].toLowerCase());
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const isBlank = (s: string) => !s.trim();

/**
 * Leading list markers, stripped from every parsed item.
 *
 * ⚠️ A REAL RÉSUMÉ TAUGHT US THIS ONE. Word's bullet lists export as the letter "o" plus a
 * space, and outline lists as "A." / "1." / "i." — so a live page shipped skills reading
 * "o C/C++/C#", "o React Native" and "A. Project Manager". The glyph is invisible in the
 * original document and very visible on the page built from it.
 *
 * "o" is only treated as a marker when it stands alone before a space, so a skill legitimately
 * beginning with the letter (say "o3 tuning") survives.
 */
const BULLET_PREFIX = /^(?:[-–—*•·◦▪‣]|o|[A-Za-z]\.|\d+[.)]|[ivxIVX]+\.)\s+/;

/** Split a line of comma/·/pipe-separated skills into individual entries. */
function splitList(line: string): string[] {
  // Strip a leading category label: real résumés write "Mobile: React Native · Expo", and
  // without this the first skill in every row carries the category glued to it.
  // ⚠️ 40, not 24. Real category labels are longer than you expect — "State Management & Data
  // Fetching:" is 32 characters, and at the old cap it survived the strip and shipped as a skill
  // chip reading "State Management & Data Fetching: Zustand".
  const body = line.replace(/^[A-Za-z][\w &/+-]{0,40}:\s*/, '');

  // ⚠️ DO NOT SPLIT INSIDE PARENTHESES. Engineers write "JavaScript (React, Next.js, Node.js)",
  // and a naive comma split turns one skill into the chips "JavaScript (React" … "Node.js)" —
  // rendered on the page as literal unbalanced brackets. Depth-tracking keeps the qualifier
  // attached to the thing it qualifies, which is also how the person meant it to read.
  const parts: string[] = [];
  let buf = '';
  let depth = 0;
  for (const ch of body) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[·|•,;]/.test(ch)) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf);

  return parts
    .flatMap((s) => (s.includes('(') ? [s] : s.split(/\s+\/\s+/))) // " / " splits only outside a qualifier
    .map((s) => clean(s).replace(BULLET_PREFIX, ''))
    // A wrapped line can hand us a fragment whose opening bracket was on the previous line
    // ("…, CodePipeline)"). Depth-tracking is per line and cannot see it, so drop the orphan.
    .map((s) => (s.includes('(') ? s : s.replace(/\)+$/, '').trim()))
    .filter((s) => s.length > 1 && s.length < 60);
}

/**
 * The separator between a role and its employer/dates, as people actually type it.
 *
 * ⚠️ THIS USED TO BE EM/EN DASH ONLY, AND THAT IS NOT HOW ANYONE TYPES. A résumé reading
 * "Shift Lead - Acme Distribution, 2019-2026" matched nothing, so the line fell through to the
 * headingless branch — and since EVERY line did, a two-job history rendered as four panels with
 * blank headings. Found by exporting one and looking at it; invisible in the parsed JSON unless
 * you read the empty strings, and invisible in `tsc` entirely.
 *
 * The spaces are load-bearing: they distinguish " - " from the hyphen inside "2019-2026".
 */
const ROLE_SEPARATOR = /\s+[—–|@]\s+|\s+-\s+/;

/**
 * Lines under EXPERIENCE → one entry per role.
 *
 * ⚠️ A LINE WITHOUT A SEPARATOR IS A CONTINUATION, NOT A NEW ROLE. Every line used to become its
 * own entry, so a role's description ("Ran a team of nine") became a second, headingless entry
 * sitting beside its own job. Attaching it to the role above invents nothing — it is the same
 * text, grouped the way the résumé already grouped it — and it stops the parser fabricating
 * entries that were never there.
 *
 * A blank line ends the current role, so a description-only first line under a new employer
 * doesn't get glued to the previous one. (sectionise preserves blank lines for exactly this
 * kind of use; see its comment.)
 */
export function parseExperience(lines: string[]): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [];
  let open = false; // is the last entry still accepting continuation lines?

  for (const raw of lines) {
    if (!raw || !raw.trim()) {
      open = false; // blank line: the role is finished
      continue;
    }
    // Same bullet-stripping as skills. Word exports bullets as a bare "o " and outline lists as
    // "A." — the glyph is invisible in the original document and very visible on the page.
    const line = clean(raw).replace(BULLET_PREFIX, '');
    if (!line) continue;

    const [head, ...rest] = line.split(ROLE_SEPARATOR);
    if (rest.length && clean(head)) {
      out.push({ heading: clean(head), body: clean(rest.join(' — ')) });
      open = true;
      continue;
    }

    if (open && out.length) {
      // Continuation of the role above. Newline-joined rather than space-joined: these are
      // usually separate bullets, and running them together makes one unreadable sentence.
      const last = out[out.length - 1];
      last.body = last.body ? `${last.body}\n${line}` : line;
      continue;
    }

    // No separator and no open role — a bare line we cannot attribute. Kept, never dropped.
    out.push({ heading: '', body: line });
    open = true;
  }

  return out;
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

  // ⚠️ STRIP EMAILS BEFORE SCANNING, NOT WHILE SCANNING. The per-match `EMAIL_RX.test(raw)` guard
  // below cannot help, because the URL pattern matches *inside* an address: from
  // "sandon.jurowski@pointsevenstudio.com" it pulls out `sandon.jurowski` and
  // `pointsevenstudio.com` as two separate "domains", neither of which is an email on its own.
  // Removing addresses first is the only version that works.
  const scannable = text.replace(EMAIL_RX_G, ' ');

  for (const m of scannable.matchAll(URL_RX)) {
    const raw = m[1];
    if (EMAIL_RX.test(raw)) continue; // an email is contact, not a link
    const bare = raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!looksLikeRealDomain(bare)) continue; // Next.js is not a website
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

  // ⚠️ A CITY IN THE CONTACT LINE IS THE ONE THING isContactOnly LEAVES BEHIND. "Renton, WA |
  // dana@example.com" strips down to "Renton WA", which is not empty, so the whole line survived
  // into the biography — a person's About-me opening with their own address line. Found by
  // exporting a résumé and reading it; the parsed JSON looked fine because the field it belonged
  // in (`location`) was simply null and honestly reported as a gap.
  //
  // So the location is MOVED, not dropped: captured into the field it belongs to, which also
  // closes the gap truthfully instead of leaving debris in a sentence.
  //
  // Deliberately conservative — "City, ST" with a two-letter state, and only when removing it
  // leaves a line that is otherwise pure contact detail. Under-matching costs a null location
  // that we already report as a gap; over-matching would put "Portland, OR" from the sentence
  // "I worked in Portland, OR for years" into someone's address.
  const LOCATION_RX = /\b[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2},\s*[A-Z]{2}\b/;
  let detectedLocation: string | null = null;

  // Rebuild paragraphs: consecutive lines are one paragraph, blanks separate them.
  const paragraphs: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const joined = buf.map(clean).filter(Boolean).join(' ').trim();
    if (joined) paragraphs.push(joined);
    buf = [];
  };
  for (const l of summaryLines) {
    if (l === '') {
      flush();
      continue;
    }
    if (isContactOnly(l)) continue;

    const hit = l.match(LOCATION_RX);
    if (hit && isContactOnly(l.replace(LOCATION_RX, ''))) {
      detectedLocation = detectedLocation ?? clean(hit[0]);
      continue; // the rest of the line was contact detail we already captured
    }
    buf.push(l);
  }
  flush();
  const summaryBody = paragraphs.join('\n\n');
  const bio = [since, summaryBody].filter(Boolean).join('\n\n') || null;

  const skills = s.skills.filter(Boolean).flatMap(splitList);

  const experience = parseExperience(s.experience);

  return {
    name: intake.name?.trim() || guessedName,
    headline: intake.headline?.trim() || null,
    // No photo. A résumé rarely carries one and we never invent an image of a person.
    photoUrl: null,
    bio,
    // What the person typed wins over what we read off a contact line — they know where they are.
    location: intake.location?.trim() || detectedLocation,
    links: collectLinks(text, intake.links),
    ...(skills.length ? { skills: skills.slice(0, 40) } : {}),
    ...(experience.length ? { experience: experience.slice(0, 20) } : {}),
    ...(email ? { email } : {}),
  } as ProfileSpec;
}
