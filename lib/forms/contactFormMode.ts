// lib/forms/contactFormMode.ts — the contact form's two shapes (owner, 2026-10-16: "a simplified
// toggle version that doesn't ask for name and phone, just email, styled").
//
// `full` is the classic form (name · email · phone · interest). `email_only` is a single styled
// field + button — a notify-me / waitlist capture — and asks for nothing else, because a form
// that asks for a phone number to tell someone when ordering opens is asking for the wrong thing.
// Pure: the renderer and the editor both read these; nothing here touches the DOM or the DB.
import type { ChromeStrings } from '@/lib/sites/siteLocale';

export type ContactFormMode = 'full' | 'email_only';

export function contactFormMode(content: unknown): ContactFormMode {
  const m = (content as { mode?: unknown } | null | undefined)?.mode;
  return m === 'email_only' ? 'email_only' : 'full';
}

export type EmailOnlyCopy = {
  description: string;
  placeholder: string;
  buttonText: string;
  successMessage: string;
  note: string;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** Owner-typed copy first, the site-language chrome string as the fallback. */
export function emailOnlyCopy(content: unknown, cs: ChromeStrings): EmailOnlyCopy {
  const c = (content ?? {}) as Record<string, unknown>;
  return {
    description: str(c.description),
    placeholder: str(c.placeholder) || cs.emailPlaceholder,
    buttonText: str(c.button_text) || cs.notifyMe,
    successMessage: str(c.success_message) || cs.emailOnlyThanks,
    note: str(c.note),
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The only validation the email-only form does. Returns the message to show, or null when fine. */
export function validateEmailOnly(email: unknown, cs: ChromeStrings): string | null {
  const v = str(email);
  if (!v) return cs.emailRequired;
  if (!EMAIL_RE.test(v)) return cs.emailInvalid;
  return null;
}
