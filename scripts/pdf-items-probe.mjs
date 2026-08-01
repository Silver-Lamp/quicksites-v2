#!/usr/bin/env node
// scripts/pdf-items-probe.mjs
//
// Print, as JSON, the raw text items real pdfjs extracts from a PDF.
//
// ⚠️ WHY A SEPARATE SCRIPT INSTEAD OF AN IMPORT IN THE TEST. pdfjs ships ESM only and its
// internals use `import.meta`, which the CJS test runner cannot require. Without this the ONLY
// way to test extraction is against hand-written item objects — and a synthetic-only suite
// happily keeps passing while the real feature is broken, because every test would encode the
// same assumption about pdfjs's API rather than checking it. Spawning a real Node process is the
// same trick verify-image-assets.mjs uses for its self-test, and for the same reason.
//
// The division of labour: this answers "what does pdfjs actually return", and the test answers
// "does our reconstruction handle it". Neither can silently drift from the other.
//
// Usage: node scripts/pdf-items-probe.mjs <file.pdf>
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: pdf-items-probe.mjs <file.pdf>');
  process.exit(2);
}

// The `legacy` build is the one that runs under Node; the browser imports the standard build.
// Both share the extraction API being probed here.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(file)),
  // Quiet the standard-font warning: we want text positions, never rendering.
  useSystemFonts: true,
}).promise;

const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const content = await (await doc.getPage(p)).getTextContent();
  pages.push(content.items.map((i) => ({ str: i.str, transform: i.transform })));
}

process.stdout.write(JSON.stringify({ numPages: doc.numPages, pages }));
