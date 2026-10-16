// lib/sites/siteLocale.ts
//
// Which language a SITE speaks — one pure read, for the chrome QuickSites draws around a site's
// own content (footer column headings, the "Hear this page" pill). The site's blocks carry the
// owner's words in whatever language they typed; this is for OUR words on their page.
//
// ⚠️ HiveJournal's UX sweep (2026-10-15) walked the Italian trattoria as a guest and found
// "Quick Links / Company Info / Find Us" under a page whose every other word was Italian, and an
// English "Hear this page" pill sitting over the booking form. The site had said `locale: 'it'`
// all along; nothing outside the booking widget read it.
//
// Source: `meta.locale`, then `meta.booking.locale`. Only languages we hold strings for; anything
// else is English, the fleet's language.
export type SiteLocale = 'it' | 'en';

export function siteLocale(siteData: unknown): SiteLocale {
  const d = siteData as Record<string, unknown> | null | undefined;
  const meta = ((d as any)?.data?.meta ?? (d as any)?.meta ?? {}) as Record<string, any>;
  const raw = String(meta.locale ?? meta.booking?.locale ?? '').toLowerCase().slice(0, 2);
  return raw === 'it' ? 'it' : 'en';
}

const CHROME = {
  en: {
    quickLinks: 'Quick Links',
    companyInfo: 'Company Info',
    findUs: 'Find Us',
    elsewhere: 'Elsewhere',
    business: 'Business',
    phone: 'Phone',
    hearThisPage: 'Hear this page',
    close: 'Close',
    dismiss: 'Dismiss',
  },
  it: {
    quickLinks: 'Link rapidi',
    companyInfo: 'Informazioni',
    findUs: 'Dove siamo',
    elsewhere: 'Altrove',
    business: 'Attività',
    phone: 'Telefono',
    hearThisPage: 'Ascolta la pagina',
    close: 'Chiudi',
    dismiss: 'Nascondi',
  },
} as const;

export type ChromeStrings = typeof CHROME.en;

export function chromeStrings(locale: SiteLocale | string | null | undefined): ChromeStrings {
  return (locale === 'it' ? CHROME.it : CHROME.en) as ChromeStrings;
}

export const CHROME_STRING_KEYS = Object.keys(CHROME.en);
export const CHROME_STRING_KEYS_IT = Object.keys(CHROME.it);

/** The attribute the site renderer stamps on its root so client chrome outside the tree can read the locale. */
export const SITE_LOCALE_ATTR = 'data-qs-locale';
