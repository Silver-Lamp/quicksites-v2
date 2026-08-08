// lib/sites/personSite.ts
//
// Is this site a person, or a business? One answer, in one place.
//
// ⚠️ THE WHOLE BUILDER SPEAKS IN THE BUSINESS PLURAL. Every default was written for a towing
// company: "Contact Us", "Our Services", "About Us", "We proudly serve the local area". On a
// portfolio or a résumé that is not a style preference, it is wrong about who is on the page —
// one person's site saying "Contact Us" reads as a company of unnamed others, which is the
// opposite of what an About-Me page is for. Sandon's own site said it, and Verbatim generates
// this template class, so every résumé we produce inherits the same voice.
//
// ⚠️ THIS IS A DEFAULT, NEVER AN OVERRIDE. If the owner typed a heading, that is their heading —
// including "Contact Us", which is a perfectly reasonable thing for a solo consultant to write.
// We choose the starting word; they own the final one.

/** Industries whose site is about a human being. Mirrors the `personSchemaEnabled` rule. */
export const PERSON_INDUSTRIES = ['personal', 'author'] as const;

export function isPersonIndustry(industry?: string | null): boolean {
  return !!industry && (PERSON_INDUSTRIES as readonly string[]).includes(industry);
}

/** The industry a template was built as, as stored by `industryScaffold`. */
export function industryOfTemplate(data: any): string | null {
  const v = data?.meta?.industry;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** True when the rendered template is a person's site. */
export function isPersonTemplate(data: any): boolean {
  if (data?.meta?.person?.enabled === true) return true;
  if (data?.meta?.person?.enabled === false) return false;
  return isPersonIndustry(industryOfTemplate(data));
}

/**
 * Default heading for the contact block.
 *
 * ⚠️ First person, not "Contact Me" as an imperative about a stranger. "Get in Touch" works
 * whether the page is a job seeker, a freelancer or an author, and does not force the visitor to
 * read a name they have already seen five times on the page.
 */
export function defaultContactHeading(data: any, businessName?: string | null): string {
  if (isPersonTemplate(data)) return 'Get in Touch';
  return businessName ? `Contact ${businessName}` : 'Contact Us';
}
