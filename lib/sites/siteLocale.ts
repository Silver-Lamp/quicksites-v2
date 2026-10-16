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
    // Contact form chrome (the owner's heading is theirs; these are ours).
    name: 'Name',
    email: 'Email',
    phoneNumber: 'Phone number',
    submit: 'Submit',
    submitting: 'Submitting…',
    orCallUs: 'Or call us at',
    replyFrom: 'We’ll reply from',
    thanks: 'Thank you! Your message has been received.',
    nameRequired: 'Name is required.',
    contactRequired: 'Please provide either an email or phone number.',
    emailInvalid: 'Email format is invalid.',
    submitFailed: 'There was a problem sending the form. Please try again.',
    formNotSetUp: 'Sorry — this form isn’t set up to receive messages right now.',
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
    name: 'Nome',
    email: 'Email',
    phoneNumber: 'Numero di telefono',
    submit: 'Invia',
    submitting: 'Invio…',
    orCallUs: 'Oppure chiamaci al',
    replyFrom: 'Ti risponderemo da',
    thanks: 'Grazie! Abbiamo ricevuto il tuo messaggio.',
    nameRequired: 'Il nome è obbligatorio.',
    contactRequired: 'Indica un’email o un numero di telefono.',
    emailInvalid: 'Formato email non valido.',
    submitFailed: 'Si è verificato un problema nell’invio. Riprova.',
    formNotSetUp: 'Questo modulo non è ancora pronto a ricevere messaggi.',
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
