// lib/comments/sanitize.ts
//
// Pure helpers for the comments block's anti-abuse layer: strip HTML (comments are
// plain text — no markup ever reaches the DOM), and strip/detect links + emails
// (link-spam is the #1 comment-abuse vector). Kept pure + tested; the route composes
// these with screenListing (prohibited content) + rate limiting.

// Source strings (not shared RegExp objects — a global-flag regex is STATEFUL, so
// reusing one across .test()/.replace() calls corrupts lastIndex). Build a fresh
// RegExp per use instead.
const URL_SRC = String.raw`(?:https?:\/\/|www\.)[^\s<>()]+`;
const EMAIL_SRC = String.raw`[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+`;
const BARE_DOMAIN_SRC = String.raw`\b[a-z0-9-]+\.(?:com|net|org|io|co|shop|store|xyz|info|biz|ru|cn)\b`;
const anyLinkTest = () => new RegExp(`${URL_SRC}|${EMAIL_SRC}|${BARE_DOMAIN_SRC}`, 'i');
const anyLinkGlobal = () => new RegExp(`${URL_SRC}|${EMAIL_SRC}|${BARE_DOMAIN_SRC}`, 'gi');

/** Plain-text only: drop any angle-bracket markup, collapse whitespace, cap length. */
export function toPlainText(input: string, maxLen = 2000): string {
  return String(input || '')
    .replace(/<[^>]*>/g, '') // no HTML tags — prevents any markup/script injection
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

/** True when the text contains a URL, email, or a bare domain (link-spam signal). */
export function containsLinks(text: string): boolean {
  return anyLinkTest().test(text);
}

/** Remove links/emails/bare-domains, leaving a readable comment (when allow_links is off). */
export function stripLinks(text: string): string {
  return text
    .replace(anyLinkGlobal(), '▪')
    .replace(/\s*▪\s*/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
