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
 * A COMPLETE `tel:` href — scheme included.
 *
 * ⚠️ It returns `tel:+12536552016`, not `+12536552016`, and the difference is not pedantry: the
 * first version of this returned bare digits while being called `telHref`, and the very next
 * line of the caller wrote `href={telHref(raw)}`. That shipped `<a href="+12536552016">`, which
 * a browser reads as a RELATIVE PATH — tap-to-call silently dead on a towing site, minutes after
 * a fix that was supposed to make the phone number right.
 *
 * A function named for what it returns must return that thing. Separate from the display form on
 * purpose: a dialer wants unpunctuated digits, a reader wants punctuation, and conflating them is
 * how the text and the link drifted apart to begin with.
 */
export function telHref(raw?: string | null): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('1')) return `tel:+${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`;
  return `tel:${digits}`;
}

/**
 * The API form: `+12536552016`, or **null** when the input is not a parseable US number.
 *
 * The third representation, and it lives here for the reason the header gives — the reader form,
 * the dialer href and the machine form disagree precisely on the awkward inputs, so they belong
 * where a change to one is read beside the others.
 *
 * ⚠️ NULL RATHER THAN A BEST EFFORT. `formatUsPhone` can safely return its input unchanged
 * because a human reads the result and notices; this value is DIALLED, so a half-parsed number
 * is a call placed to the wrong person. The caller must handle null.
 *
 * ⚠️ Its job is to spare a human the format, not to enforce it. Every phone we hold about a
 * business is display-format (`(253) 326-5555` — it is what Places returns), while every phone
 * we dial must be E.164, and asking an operator to convert between them by hand is how the
 * re-point box shipped a validation error on a number that was already correct.
 */
export function usE164(raw?: string | null): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) return null;
  // NANP: neither the area code nor the exchange may begin with 0 or 1.
  if (national[0] === '0' || national[0] === '1') return null;
  return `+1${national}`;
}
