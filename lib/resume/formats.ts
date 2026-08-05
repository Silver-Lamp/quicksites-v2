// lib/resume/formats.ts
//
// One outline → Markdown, print-ready HTML, and DOCX.
//
// ⚠️ PDF IS NOT HERE ON PURPOSE. It is produced by printing the HTML in headless Chromium, which
// needs a browser and therefore cannot live in a pure module. Keeping the three text formats pure
// means they are testable without a binary, and it means the PDF is provably the same document as
// the HTML rather than a fourth interpretation of the source.
//
// ⚠️ NO BRANDING IN ANY OUTPUT. These are files someone sends to a hiring manager. A "made with"
// footer on a résumé is us advertising through a person's job search — the same borrowed-trust
// failure the library thread warned about, aimed at an individual. Same rule as the Verbatim
// profile export.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx';
import type { ResumeOutline } from './outline';

/* ─────────────────────────── Markdown ─────────────────────────── */

export function toMarkdown(o: ResumeOutline): string {
  const out: string[] = [`# ${o.name}`];
  if (o.contact.length) out.push('', o.contact.join(' · '));

  for (const n of o.nodes) {
    switch (n.kind) {
      case 'section':
        // Title Case the shouting: "PROFESSIONAL SUMMARY" is a layout choice, not the person's voice.
        out.push('', `## ${titleCase(n.text)}`, '');
        break;
      case 'role':
        out.push('', `### ${n.text}`, '');
        break;
      case 'para':
        out.push(n.text, '');
        break;
      case 'bullet':
        out.push(`- ${n.text}`);
        break;
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function titleCase(s: string): string {
  const small = new Set(['and', 'or', 'of', 'the', 'for']);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/* ─────────────────────── Print-ready HTML ─────────────────────── */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * ⚠️ LIGHT SCHEME, EXPLICITLY. `color-scheme: only light` stops a dark-mode browser inverting a
 * document that exists to be printed — a résumé that prints as a black page is worse than no
 * résumé, and the failure only shows up on someone else's machine.
 */
export function toPrintHtml(o: ResumeOutline): string {
  const body: string[] = [];
  for (const n of o.nodes) {
    if (n.kind === 'section') body.push(`<h2>${esc(titleCase(n.text))}</h2>`);
    else if (n.kind === 'role') body.push(`<h3>${esc(n.text)}</h3>`);
    else if (n.kind === 'para') body.push(`<p>${esc(n.text)}</p>`);
    else body.push(`<li>${esc(n.text)}</li>`);
  }
  // Wrap consecutive <li> in <ul> without a second pass over the outline.
  const html = body
    .join('\n')
    .replace(/(?:<li>.*?<\/li>\n?)+/gs, (m) => `<ul>\n${m.trim()}\n</ul>`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(o.name)}</title>
<style>
  :root { color-scheme: only light; }
  @page { size: Letter; margin: 0.6in; }
  body { font: 10.5pt/1.45 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #16181d; margin: 0; }
  h1 { font-size: 20pt; margin: 0 0 2pt; letter-spacing: -.01em; }
  .contact { font-size: 9.5pt; color: #4a4f57; margin: 0 0 14pt; }
  h2 { font-size: 9pt; text-transform: uppercase; letter-spacing: .10em; color: #4a4f57;
       border-bottom: .5pt solid #c9ccd1; padding-bottom: 2pt; margin: 15pt 0 6pt;
       break-after: avoid; }
  h3 { font-size: 10.5pt; margin: 9pt 0 2pt; break-after: avoid; }
  p  { margin: 0 0 6pt; }
  ul { margin: 0 0 6pt; padding-left: 15pt; }
  li { margin: 0 0 2.5pt; break-inside: avoid; }
</style></head><body>
<h1>${esc(o.name)}</h1>
<p class="contact">${esc(o.contact.join(' · '))}</p>
${html}
</body></html>`;
}

/* ───────────────────────────── DOCX ───────────────────────────── */

/**
 * ⚠️ REAL WORD STYLES, NOT STYLED TEXT. Recruiters and applicant-tracking systems parse .docx
 * structurally; a document that merely *looks* like it has headings — bold runs in body
 * paragraphs — reads to a parser as one undifferentiated blob, which is the whole reason a .docx
 * is requested in the first place. HeadingLevel is the point of the format.
 */
export async function toDocx(o: ResumeOutline): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: o.name, bold: true, size: 40 })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
    }),
  ];

  if (o.contact.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: o.contact.join(' · '), size: 19, color: '4A4F57' })],
        spacing: { after: 240 },
      }),
    );
  }

  for (const n of o.nodes) {
    if (n.kind === 'section') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 260, after: 90 },
          children: [new TextRun({ text: titleCase(n.text).toUpperCase(), bold: true, size: 19 })],
        }),
      );
    } else if (n.kind === 'role') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 150, after: 40 },
          children: [new TextRun({ text: n.text, bold: true, size: 22 })],
        }),
      );
    } else if (n.kind === 'para') {
      children.push(
        new Paragraph({ spacing: { after: 110 }, children: [new TextRun({ text: n.text, size: 21 })] }),
      );
    } else {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 50 },
          children: [new TextRun({ text: n.text, size: 21 })],
        }),
      );
    }
  }

  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
