// lib/phone/formatUs.ts
//
// ONE phone formatter for rendered sites.
//
// ⚠️ THE BUG THIS REPLACES INVENTED A DIALABLE NUMBER. `contact-form.tsx` formatted with
//
//     String(raw).replace(/\D/g, '').slice(0, 10)
//
// which TRUNCATES rather than strips the country code — so the E.164 `+12536552016` became
// `1253655201` and rendered as **"(125) 365-5201"**. That went live on southhilltowing.com the
// hour a real tracking number was put on it. The `tel:` href used the full digits and worked, so
// tapping it was fine and READING it was wrong: the one failure mode that survives every click
// test and only hurts the person who dials by hand.
//
// ⚠️ THE OTHER TWO FORMATTERS WERE ALREADY SAFE, AND THE DIFFERENCE IS THE WHOLE LESSON.
// `hero.tsx` and `footer.tsx` both `return raw` when the digits are not exactly 10 — ugly (a
// bare `+12536552016` on the page) but TRUE. Truncating is prettier and lies. When a formatter
// cannot parse its input, showing the input is the only safe answer.
//
// Three copies existed because each renderer needed "a phone, nicely". They agreed on the happy
// path and disagreed on exactly the input a tracking number produces.

/** A US number as `(253) 655-2016`, or the input unchanged when it cannot be parsed. */
export function formatUsPhone(raw?: string | null): string {
  const input = String(raw ?? '');
  const digits = input.replace(/\D/g, '');
  // ⚠️ STRIP a leading country code, never slice. 11 digits starting with 1 is `1` + NANP.
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) return input;
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

/**
 * Digits for a `tel:` href — `+1` kept when the input carried it.
 *
 * Separate from the display form on purpose: a dialer wants unpunctuated digits, a reader wants
 * punctuation, and conflating them is how the text and the link drifted apart in the first place.
 */
export function telHref(raw?: string | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return digits;
}
