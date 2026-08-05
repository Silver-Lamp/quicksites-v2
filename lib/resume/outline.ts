// lib/resume/outline.ts
//
// A résumé's plain text → a small structured outline, so one source produces Markdown, PDF and
// DOCX that actually agree.
//
// ⚠️ ONE PARSE, THREE EMITTERS — NEVER THREE PARSERS. The whole failure mode of "also give me a
// PDF and a Word version" is three code paths that drift, so the DOCX quietly loses a job the PDF
// still lists. This module is the single interpretation of the document; `lib/resume/formats.ts`
// only renders it. If a format looks wrong, the bug is here or in that format's emitter, never in
// "which one is right".
//
// ⚠️ AND IT IS DELIBERATELY DUMB. It recognises three things — a SECTION HEADING, a ROLE line, and
// everything else as a bullet. A résumé has no schema, and a parser that tries to be clever
// produces confident nonsense on the documents it misreads. Under-parsing costs a formatting nit;
// over-parsing rearranges someone's employment history.

export type OutlineNode =
  | { kind: 'section'; text: string }
  | { kind: 'role'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'para'; text: string };

export type ResumeOutline = {
  name: string;
  contact: string[];
  nodes: OutlineNode[];
};

/** ALL-CAPS lines like "PROFESSIONAL SUMMARY" / "EXPERIENCE" / "TECHNICAL SKILLS". */
function isSectionHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 40) return false;
  if (!/^[A-Z][A-Z\s&/]+$/.test(t)) return false;
  return t === t.toUpperCase();
}

/**
 * A role line: "Title — Company (dates)" or "Product — one-line description".
 * The em/en dash and " - " are all in use; the spaces matter, or "2019-2026" matches.
 */
function isRoleLine(line: string): boolean {
  const t = line.trim();
  if (t.length > 140) return false;
  return /\s+[—–]\s+/.test(t) || /\s+-\s+/.test(t);
}

/** A "Label: comma, separated, list" line — kept whole rather than bulleted per item. */
function isLabeledList(line: string): boolean {
  return /^[A-Z][\w &/+-]{0,40}:\s+\S/.test(line.trim());
}

export function parseResumeOutline(text: string): ResumeOutline {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  // The name is the first non-blank line; contact lines are whatever precedes the first heading.
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const name = (lines[i] ?? '').trim();
  i++;

  const contact: string[] = [];
  while (i < lines.length && !isSectionHeading(lines[i])) {
    const t = lines[i].trim();
    if (t) contact.push(t);
    i++;
  }

  const nodes: OutlineNode[] = [];
  // ⚠️ WHAT MAKES A PARAGRAPH IS THE SECTION, NOT THE LENGTH. The first version treated any line
  // over 220 characters as prose, which is true of a professional summary and false of a good
  // résumé bullet — so the longest, most substantial achievements ("Led a security remediation
  // across the API surface…") silently dropped out of the bulleted list and rendered as loose
  // paragraphs, breaking the list around them. Caught by looking at the generated PDF; the
  // Markdown looked plausible on its own.
  let inSummary = false;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) continue;

    if (isSectionHeading(t)) {
      inSummary = /summary|profile|objective|about/i.test(t);
      nodes.push({ kind: 'section', text: t });
      continue;
    }
    if (isLabeledList(t)) {
      nodes.push({ kind: 'bullet', text: t });
      continue;
    }
    if (isRoleLine(t)) {
      nodes.push({ kind: 'role', text: t });
      continue;
    }
    // Prose only inside a summary-like section; everywhere else a long line is a long bullet.
    nodes.push({ kind: inSummary ? 'para' : 'bullet', text: t });
  }

  return { name, contact, nodes };
}
