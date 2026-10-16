// lib/booking/reference.ts
//
// The booking's short reference: the row id's first 8 hex characters, upper-cased. A guest reads
// it to the restaurant over the phone; the owner page can search the id by its prefix. Pure, in
// lib/ rather than the widget, because a route or an email may need the same spelling.
export function bookingReference(id: string): string {
  return String(id ?? '').replace(/-/g, '').slice(0, 8).toUpperCase();
}
