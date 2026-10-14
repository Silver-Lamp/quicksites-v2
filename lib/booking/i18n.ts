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
  },
} as const;

export type BookingStrings = typeof STRINGS.en;

export function bookingStrings(locale: BookingLocale | string | null | undefined): BookingStrings {
  return (locale === 'it' ? STRINGS.it : STRINGS.en) as BookingStrings;
}

/** `2026-10-18` → "sabato 18 ottobre" / "Saturday, October 18". */
export function longDate(date: string, locale: BookingLocale, tz: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }).format(d);
}

export const BOOKING_STRING_KEYS = Object.keys(STRINGS.en);
export const BOOKING_STRING_KEYS_IT = Object.keys(STRINGS.it);
