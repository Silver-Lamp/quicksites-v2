// lib/booking/i18n.ts
//
// Every sentence the booking widget, the owner page and the confirmation email say, in Italian
// and English — one table, both languages, keyed. QuickSites has no translation layer; this is
// the strings table scoped to this feature (the Italy proposal, 2026-10-13), and a test pins
// that the two languages carry the same keys so a missing Italian line cannot ship as English.
export type BookingLocale = 'it' | 'en';

const STRINGS = {
  en: {
    title: 'Book a table',
    intro: 'Pick a day, how many of you, and a time. We hold the table for ninety minutes.',
    date: 'Day',
    party: 'Guests',
    time: 'Time',
    noTimes: 'No tables free that day for a party that size.',
    tooBig: 'For a party that size, please call us.',
    call: 'Call',
    name: 'Your name',
    phone: 'Phone',
    email: 'Email (optional)',
    notes: 'Anything we should know? (optional)',
    submit: 'Book the table',
    booking: 'Booking…',
    confirmedTitle: 'Table booked',
    confirmed: (p: { time: string; dateLong: string; party: number; table: string }) => `${p.party} ${p.party === 1 ? 'guest' : 'guests'} on ${p.dateLong} at ${p.time}. Table ${p.table}. We will see you then.`,
    taken: 'That time was just taken. Pick another.',
    failed: 'We could not book that. Please call us.',
    loading: 'Looking for a table…',
    closed: 'Closed that day.',
    // the guest widget, after HiveJournal's UX sweep (2026-10-15)
    phoneWhy: 'so we can confirm your booking',
    lunch: 'Lunch',
    dinner: 'Dinner',
    full: 'full',
    serviceFull: (service: string) => `${service} is fully booked. Try another day.`,
    dayFull: 'Fully booked that day. Try another day.',
    reference: 'Booking reference',
    addToCalendar: 'Add to calendar',
    changeByPhone: 'To change or cancel, call',
    changeNoPhone: 'To change or cancel, contact the restaurant.',
    emailSent: (email: string) => `We sent a confirmation to ${email}.`,
    // owner page
    ownerTitle: 'Bookings',
    tonight: 'Tonight',
    tomorrow: 'Tomorrow',
    none: 'No bookings.',
    addPhone: 'Add a phone booking',
    cancel: 'Cancel',
    cancelled: 'Cancelled',
    seated: 'Seated',
    byPhone: 'by phone',
    guests: (n: number) => `${n} ${n === 1 ? 'guest' : 'guests'}`,
    table: 'Table',
    // email
    emailSubject: (p: { restaurant: string }) => `Your table at ${p.restaurant}`,
    emailBody: (p: { restaurant: string; dateLong: string; time: string; party: number; table: string; phone: string | null }) =>
      `Your table at ${p.restaurant} is booked: ${p.party} ${p.party === 1 ? 'guest' : 'guests'} on ${p.dateLong} at ${p.time} (table ${p.table}).${p.phone ? ` To change it, call ${p.phone}.` : ''}`,
    ownerEmailSubject: (p: { restaurant: string }) => `New booking — ${p.restaurant}`,
    // preview sites (lib/booking/settings.ts `preview`): the widget runs, nothing is recorded
    previewBanner: (p: { name: string }) => `Preview — the times shown are placeholders. Booking goes live when ${p.name || 'the owner'} claims this site and sets real hours.`,
    previewConfirmed: 'This was a preview. Nothing was booked.',
  },
  it: {
    title: 'Prenota un tavolo',
    intro: 'Scegli il giorno, quanti siete e l’orario. Il tavolo resta vostro per novanta minuti.',
    date: 'Giorno',
    party: 'Persone',
    time: 'Orario',
    noTimes: 'Nessun tavolo libero quel giorno per questo numero di persone.',
    tooBig: 'Per un gruppo così numeroso, chiamateci.',
    call: 'Chiama',
    name: 'Il tuo nome',
    phone: 'Telefono',
    email: 'Email (facoltativa)',
    notes: 'Qualcosa da sapere? (facoltativo)',
    submit: 'Prenota il tavolo',
    booking: 'Prenotazione in corso…',
    confirmedTitle: 'Tavolo prenotato',
    confirmed: (p: { time: string; dateLong: string; party: number; table: string }) => `${p.party} ${p.party === 1 ? 'persona' : 'persone'} ${p.dateLong} alle ${p.time}. Tavolo ${p.table}. Vi aspettiamo.`,
    taken: 'Quell’orario è appena stato preso. Scegline un altro.',
    failed: 'Non siamo riusciti a prenotare. Chiamateci.',
    loading: 'Cerco un tavolo…',
    closed: 'Chiuso quel giorno.',
    phoneWhy: 'per confermare la prenotazione',
    lunch: 'Pranzo',
    dinner: 'Cena',
    full: 'pieno',
    serviceFull: (service: string) => `${service} al completo. Prova un altro giorno.`,
    dayFull: 'Tutto esaurito quel giorno. Prova un altro giorno.',
    reference: 'Codice prenotazione',
    addToCalendar: 'Aggiungi al calendario',
    changeByPhone: 'Per modificare o annullare, chiama il',
    changeNoPhone: 'Per modificare o annullare, contatta il ristorante.',
    emailSent: (email: string) => `Ti abbiamo mandato una conferma a ${email}.`,
    ownerTitle: 'Prenotazioni',
    tonight: 'Stasera',
    tomorrow: 'Domani',
    none: 'Nessuna prenotazione.',
    addPhone: 'Aggiungi una prenotazione telefonica',
    cancel: 'Annulla',
    cancelled: 'Annullata',
    seated: 'Al tavolo',
    byPhone: 'per telefono',
    guests: (n: number) => `${n} ${n === 1 ? 'persona' : 'persone'}`,
    table: 'Tavolo',
    emailSubject: (p: { restaurant: string }) => `Il tuo tavolo da ${p.restaurant}`,
    emailBody: (p: { restaurant: string; dateLong: string; time: string; party: number; table: string; phone: string | null }) =>
      `Il tuo tavolo da ${p.restaurant} è prenotato: ${p.party} ${p.party === 1 ? 'persona' : 'persone'} ${p.dateLong} alle ${p.time} (tavolo ${p.table}).${p.phone ? ` Per modificare, chiama il ${p.phone}.` : ''}`,
    ownerEmailSubject: (p: { restaurant: string }) => `Nuova prenotazione — ${p.restaurant}`,
    previewBanner: (p: { name: string }) => `Anteprima — gli orari mostrati sono indicativi. Le prenotazioni si attivano quando ${p.name || 'il titolare'} rivendica il sito e imposta gli orari reali.`,
    previewConfirmed: 'Era un\'anteprima. Non è stato prenotato nulla.',
  },
} as const;

/** The strings' SHAPE, with each literal widened to `string` so a second vocabulary (the appointment overlay) can fill the same keys. */
export type BookingStrings = { [K in keyof typeof STRINGS.en]: (typeof STRINGS.en)[K] extends string ? string : (typeof STRINGS.en)[K] };

/**
 * APPOINTMENT vocabulary — one provider, one person, a time rather than a table. An OVERLAY on
 * the restaurant strings, never a second table: it may only replace keys the base has (pinned by
 * a test), so a sentence the widget needs always exists in both modes. `table` becomes the word
 * before the provider's name ("with Katie"); `lunch`/`dinner` become the morning/afternoon group
 * headings; the guests picker is hidden by the widget, so `party`/`tooBig` are never shown.
 */
const APPOINTMENT: Record<BookingLocale, Partial<BookingStrings>> = {
  en: {
    title: 'Book a time',
    intro: 'Pick a day and a time that suits you.',
    party: 'People',
    noTimes: 'No free times that day.',
    tooBig: 'Please call to arrange that.',
    submit: 'Book this time',
    confirmedTitle: 'Time booked',
    confirmed: (p) => `${p.dateLong} at ${p.time}. See you then.`,
    loading: 'Looking for free times…',
    lunch: 'Morning',
    dinner: 'Afternoon',
    changeNoPhone: 'To change or cancel, get in touch.',
    guests: (n) => `${n} ${n === 1 ? 'person' : 'people'}`,
    table: 'with',
    emailSubject: (p) => `Your appointment with ${p.restaurant}`,
    emailBody: (p) => `Your appointment with ${p.restaurant} is booked for ${p.dateLong} at ${p.time}.${p.phone ? ` To change it, call ${p.phone}.` : ''}`,
    ownerEmailSubject: (p) => `New appointment — ${p.restaurant}`,
  },
  it: {
    title: 'Prenota un orario',
    intro: 'Scegli un giorno e un orario che ti va bene.',
    party: 'Persone',
    noTimes: 'Nessun orario libero quel giorno.',
    tooBig: 'Per favore chiama per organizzarlo.',
    submit: 'Prenota questo orario',
    confirmedTitle: 'Orario prenotato',
    confirmed: (p) => `${p.dateLong} alle ${p.time}. A presto.`,
    loading: 'Cerco orari liberi…',
    lunch: 'Mattina',
    dinner: 'Pomeriggio',
    changeNoPhone: 'Per modificare o annullare, contattaci.',
    guests: (n) => `${n} ${n === 1 ? 'persona' : 'persone'}`,
    table: 'con',
    emailSubject: (p) => `Il tuo appuntamento con ${p.restaurant}`,
    emailBody: (p) => `Il tuo appuntamento con ${p.restaurant} è prenotato per ${p.dateLong} alle ${p.time}.${p.phone ? ` Per modificare, chiama il ${p.phone}.` : ''}`,
    ownerEmailSubject: (p) => `Nuovo appuntamento — ${p.restaurant}`,
  },
};

export type BookingStringsMode = 'table' | 'appointment';

export function bookingStrings(locale: BookingLocale | string | null | undefined, mode: BookingStringsMode = 'table'): BookingStrings {
  const loc: BookingLocale = locale === 'it' ? 'it' : 'en';
  const base = STRINGS[loc] as BookingStrings;
  return mode === 'appointment' ? ({ ...base, ...APPOINTMENT[loc] } as BookingStrings) : base;
}

/** The keys the appointment overlay touches (en) — a test pins them to a subset of the base keys. */
export const APPOINTMENT_OVERLAY_KEYS = Object.keys(APPOINTMENT.en);
export const APPOINTMENT_OVERLAY_KEYS_IT = Object.keys(APPOINTMENT.it);

/** `2026-10-18` → "sabato 18 ottobre" / "Saturday, October 18". */
export function longDate(date: string, locale: BookingLocale, tz: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }).format(d);
}

export const BOOKING_STRING_KEYS = Object.keys(STRINGS.en);
export const BOOKING_STRING_KEYS_IT = Object.keys(STRINGS.it);
