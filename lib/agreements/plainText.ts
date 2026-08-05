// lib/agreements/plainText.ts
//
// Markdown → the plain text that will be STORED, shown, and hashed.
//
// ⚠️ THIS RUNS AT AUTHORING TIME, NEVER AT DISPLAY TIME, AND THAT IS THE WHOLE POINT. The
// signing page renders the stored text as plain paragraphs precisely so there is no gap between
// what was hashed and what was read — a renderer that reinterprets the source is exactly where a
// signing product can mislead without anyone noticing. Converting here keeps that property: what
// is stored IS what is shown IS what is hashed, and the markdown never reaches the database.
//
// It exists because the first real agreement was authored as a markdown file (the repo's template
// is one, and the column is even called `body_md`), so a contributor's contract rendered on the
// live page as `# Volunteer Contributor Agreement`, `**Between:**` and `### 1. Nature of the
// relationship`. Caught by taking a screenshot of the production page — invisible to tsc, to the
// tests, and to every check that read the stored text rather than looking at it.
//
// ⚠️ EVERY TRANSFORM HERE MUST BE MEANING-PRESERVING. It removes SYNTAX, never words: emphasis
// markers, heading hashes, blockquote arrows, horizontal rules, link syntax around a visible
// label. It must never drop a sentence, reorder anything, or resolve a reference. A contract is
// the one document where "tidying" is indistinguishable from altering, so when in doubt, leave
// the characters alone — an unconverted artefact reads slightly oddly; a converted one that lost
// a clause is a different agreement.

/** True if the text contains markdown syntax we would strip. Used only to warn an author. */
export function looksLikeMarkdown(text: string): boolean {
  return /^#{1,6}\s|\*\*|^>\s|^---\s*$|\[[^\]]+\]\([^)]+\)/m.test(text);
}

/**
 * Convert markdown source to the plain text a signer will read.
 *
 * Deliberately narrow — it handles the constructs that appear in real agreements and leaves
 * everything else untouched.
 */
export function markdownToPlainText(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];

  for (const raw of lines) {
    let line = raw;

    // Horizontal rule → a paragraph break, not a row of dashes in a contract.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push('');
      continue;
    }

    // Blockquote marker. The TEXT of a quote is content (our template's "not legal advice"
    // warning is a blockquote), so only the arrow goes.
    line = line.replace(/^\s{0,3}>\s?/, '');

    // ATX heading → the heading text on its own line. The hashes are syntax; the words are not.
    line = line.replace(/^\s{0,3}(#{1,6})\s+/, '');

    // Inline emphasis. Order matters: ** before * so bold isn't left with a stray marker.
    line = line
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
      .replace(/`([^`]+)`/g, '$1');

    // [label](href) → "label (href)". The href is kept: a contract that silently drops the URL
    // it points at has lost a term.
    line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

    // Leading list markers become a bullet character, so structure survives without syntax.
    line = line.replace(/^\s{0,3}[-*+]\s+/, '• ');

    out.push(line);
  }

  // Collapse the runs of blank lines the horizontal rules leave behind, and trim the ends —
  // canonicalize() would do the trailing part anyway, but the stored text should look right
  // in the database too.
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    // `\n*$` rather than `\n+$` — the latter matches nothing when the input has no trailing
    // newline, so a single-line document came out unterminated while a multi-line one didn't.
    // Always exactly one, matching canonicalize().
    .replace(/\n*$/, '\n');
}
