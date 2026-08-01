'use client';

// lib/rebuild/pdfText.ts
//
// Pull the text out of a PDF résumé — IN THE BROWSER, never on our servers.
//
// ⚠️ THE CLIENT-SIDE CHOICE IS THE POINT, NOT AN OPTIMISATION. A résumé is a dense block of
// personal data: full name, address, phone, employment history, sometimes a date of birth. The
// server needs the *text* to build a page; it never needs the *file*. So the file stays on the
// person's device and only the extracted text is posted.
//
// That is the honest-custody argument applied where it actually holds — don't hold what you
// don't need — and unlike an encryption scheme it costs nothing and can't be lost. It also means
// a failed upload leaks nothing: if extraction fails, no bytes were ever sent.
//
// ⚠️ AND EXTRACTION IS LOSSY, SO THE RESULT IS SHOWN BEFORE IT IS USED. A PDF stores positioned
// glyphs, not paragraphs. Multi-column CVs interleave, tables scramble, and a résumé built as an
// image extracts to nothing at all. The intake therefore drops the text into the textarea for
// the person to see and correct rather than posting it straight through — the parser downstream
// refuses to invent, so garbage in must be visible, not silently rearranged into a page.
//
// pdfjs is loaded by DYNAMIC IMPORT so its ~1MB only reaches people who actually pick a PDF.

import { linesFromItems, classifyExtraction, type TextItemLike, type ExtractionQuality } from './pdfLines';

export type { TextItemLike, ExtractionQuality };

export type PdfExtractResult = {
  text: string;
  pages: number;
  /** See classifyExtraction in ./pdfLines — deliberately a measurement, never a diagnosis. */
  quality: ExtractionQuality;
};

// The quality rule (and the story behind it) lives in ./pdfLines so it can be tested.

export async function extractPdfText(file: File): Promise<PdfExtractResult> {
  const pdfjs: any = await import('pdfjs-dist');
  // pdfjs needs a worker; point it at the copy shipped with the package rather than a CDN —
  // a strict CSP blocks external hosts, and a résumé parser reaching out to a third party
  // would undercut the whole reason this runs client-side.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    parts.push(linesFromItems(content.items as TextItemLike[]).join('\n'));
  }

  const text = parts.join('\n\n').trim();
  const pages = doc.numPages;
  return { text, pages, quality: classifyExtraction(text, pages) };
}
