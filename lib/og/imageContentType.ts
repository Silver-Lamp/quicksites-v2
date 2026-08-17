// lib/og/imageContentType.ts
//
// ⚠️ DECIDE AN IMAGE'S CONTENT TYPE FROM ITS BYTES, NEVER FROM ITS FILENAME.
//
// `/api/og/[slug]/image` cached its output at `snapshots/<slug>.svg` and served every hit with
// `Content-Type: image/svg+xml`, taken from the path. The cached object held **PNG bytes**. A
// browser trusts the declared type, tries to parse PNG as XML, and renders a broken-image icon —
// which is exactly what appeared on lemonyum.com, in the one section of that page whose whole job
// is to prove we can build a real site.
//
// Every layer looked fine while it was broken: HTTP 200, a plausible content type, 32KB of real
// bytes, no CORS error, no CSP, both hosts identical. The fetch was never the problem. `file`
// said `data` and the first eight bytes said `\x89PNG` — the only two instruments that could see
// it, and neither is one you reach for when the symptom is "image doesn't load".
//
// This repo has now paid for the same lesson twice: the 404 page was a 2054KB PNG named `.webp`
// (convert, don't rename), and this is its mirror image — bytes and label disagreeing, with the
// label winning because it was cheaper to read. Hence a sniffer rather than a fix at one call
// site: the next cache written by the next generator will disagree with its extension too.

/** Magic numbers, in the order a real file will match them. */
const SIGNATURES: Array<{ type: string; test: (b: Uint8Array, head: string) => boolean }> = [
  { type: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/gif', test: (_b, head) => head.startsWith('GIF87a') || head.startsWith('GIF89a') },
  // RIFF....WEBP
  {
    type: 'image/webp',
    test: (b, head) => head.startsWith('RIFF') && String.fromCharCode(b[8], b[9], b[10], b[11]) === 'WEBP',
  },
  // SVG is text, so it is matched LAST and by content rather than by luck: an XML prolog or an
  // <svg element within the first bytes. Anything binary has already matched above.
  { type: 'image/svg+xml', test: (_b, head) => /^\s*(<\?xml|<!--|<svg)/i.test(head) },
];

/**
 * The true content type of an image payload, or null when the bytes match nothing known.
 *
 * Null is deliberate and callers must handle it: guessing on an unrecognised payload is how the
 * original bug worked. A caller with no answer should say so (or omit the header and let the
 * browser sniff) rather than assert something plausible.
 */
export function sniffImageContentType(bytes: Uint8Array): string | null {
  if (!bytes || bytes.length < 12) return null;
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 64));
  for (const sig of SIGNATURES) {
    if (sig.test(bytes, head)) return sig.type;
  }
  return null;
}

/** The extension that matches a content type, for writing a cache path that does not lie. */
export function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/svg+xml': return 'svg';
    default: return 'bin';
  }
}
