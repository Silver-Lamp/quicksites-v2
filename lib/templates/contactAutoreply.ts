// lib/templates/contactAutoreply.ts — the email the PERSON WHO SUBMITTED a site's form receives.
//
// ⚠️ Until 2026-10-16 this was one hard-coded QuickSites note ("Thanks for contacting us! … — The
// QuickSites Team") sent for every tenant site — the owner signed up on B Hard's "Get notified"
// form and got a platform email from a sender the visitor had never heard of. It is the
// merchant's touchpoint, not ours: the business's name on the From line, their words in the
// body, replies going to their contact address. Configured on the contact_form block (the
// editor's "Auto-reply" section); defaults depend on the form's mode. Pure: the route calls it.
import { contactFormMode, type ContactFormMode } from '@/lib/forms/contactFormMode';
import { pickContactEmail } from '@/lib/templates/contactRecipient';
import { tenantSiteHost } from '@/lib/sites/tenantRoot';

export type AutoreplyResolved = {
  enabled: boolean;
  fromName: string;
  subject: string;
  text: string;
  replyTo: string | null;
};

export type AutoreplyInput = {
  /** Who submitted (full form only; the email-only form has no name). */
  name?: string | null;
  email?: string | null;
  /** The form's mode as the submitting page saw it; falls back to the block's own setting. */
  mode?: ContactFormMode | null;
};

const dget = (o: unknown, path: string): unknown => path.split('.').reduce<any>((acc, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), o);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The first contact_form block's content, from whichever page copy has it. */
export function findContactFormContent(data: unknown): Record<string, unknown> | null {
  const pages = (dget(data, 'pages') as unknown[]) ?? [];
  for (const pg of Array.isArray(pages) ? pages : []) {
    for (const key of ['blocks', 'content_blocks']) {
      const list = (dget(pg, key) as unknown[]) ?? [];
      for (const b of Array.isArray(list) ? list : []) {
        if ((b as any)?.type === 'contact_form') {
          const c = (b as any).content ?? (b as any).props;
          if (c && typeof c === 'object') return c as Record<string, unknown>;
        }
      }
    }
  }
  return null;
}

export function businessNameOf(row: unknown): string {
  return str((row as any)?.business_name) || str(dget(row, 'data.meta.business_name')) || str(dget(row, 'data.meta.business')) || str((row as any)?.template_name) || str((row as any)?.slug) || 'the team';
}

export function siteHostOf(row: unknown): string {
  const cd = str((row as any)?.custom_domain);
  if (cd) return cd;
  const slug = str((row as any)?.slug);
  return slug ? tenantSiteHost(slug) : '';
}

/** Defaults by form mode — the merchant's words win whenever they typed any. */
export function defaultAutoreply(mode: ContactFormMode): { subject: string; body: string } {
  if (mode === 'email_only') {
    return { subject: 'You’re on the list — {business}', body: 'Thanks for signing up. We’ll email you at this address when there’s news.\n\n— {business}' };
  }
  return { subject: 'Thanks for contacting {business}', body: 'Hi {name},\n\nThanks for reaching out. We’ve received your message and will get back to you shortly.\n\n— {business}' };
}

/** `{name}` `{business}` `{email}` `{site}`; a missing name reads "there". */
export function fillPlaceholders(tpl: string, vars: { name?: string | null; business: string; email?: string | null; site?: string }): string {
  const name = str(vars.name) || 'there';
  return tpl
    .replace(/\{\s*name\s*\}/gi, name)
    .replace(/\{\s*business\s*\}/gi, vars.business)
    .replace(/\{\s*email\s*\}/gi, str(vars.email))
    .replace(/\{\s*site\s*\}/gi, vars.site ?? '');
}

export function resolveAutoreply(row: unknown, input: AutoreplyInput = {}): AutoreplyResolved {
  const c = findContactFormContent(dget(row, 'data')) ?? {};
  const mode: ContactFormMode = input.mode ?? contactFormMode(c);
  const business = str(c.autoreply_from_name) || businessNameOf(row);
  const site = siteHostOf(row);
  const d = defaultAutoreply(mode);
  const vars = { name: input.name, business, email: input.email, site };
  const enabled = c.autoreply_enabled !== false; // on unless the merchant switched it off
  const subject = fillPlaceholders(str(c.autoreply_subject) || d.subject, vars);
  let text = fillPlaceholders(str(c.autoreply_body) || d.body, vars);
  // Why they got this, in one line — a transactional note after a form they just submitted.
  if (site) text += `\n\nYou’re receiving this because you submitted a form on ${site}.`;
  return { enabled, fromName: business, subject, text, replyTo: pickContactEmail(row) };
}
