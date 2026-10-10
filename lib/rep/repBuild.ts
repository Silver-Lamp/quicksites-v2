// lib/rep/repBuild.ts
//
// The pure half of the rep's one-click build: the links a built draft hands back and the text
// message the rep can send with them. The I/O (verify, cap, build) is the route.
//
// ⚠️ EVERY LINK CARRIES `?ref=<code>`. Attribution rides the `qs_ref` cookie, which middleware
// sets from a `ref` query on ANY path. A preview or claim link without it is a referral the rep
// did the work for and will never be paid for — the one way this feature could quietly cheat
// the person it was built for.
//
// ⚠️ THE TEXT MESSAGE MAKES NO PROMISE. It is the rep's words to a business owner on an island
// where everyone knows everyone; it says a first version exists and asks them to look. Held to
// the claim postcard's forbidden list by test.

/** How many drafts one code may build per rolling day. Each costs Places + a vision call. */
export const REP_BUILDS_PER_DAY = 15;

export function withRef(url: string, code: string): string {
  const u = new URL(url);
  u.searchParams.set('ref', code);
  return u.toString();
}

export function repBuildLinks(input: { slug: string; industryKey: string | null; prospectId: string; code: string; base?: string; menuHost?: string | null }): {
  previewUrl: string;
  claimUrl: string;
} {
  const base = (input.base ?? 'https://www.quicksites.ai').replace(/\/+$/, '');
  const isRestaurant = input.industryKey === 'restaurant';
  // The apex form linkifies on a phone; the bare <slug>.delivered.menu does not (new gTLD).
  const preview = isRestaurant && input.menuHost ? `https://deliveredmenu.com/${input.slug}` : `${base}/sites/${input.slug}`;
  return {
    previewUrl: withRef(preview, input.code),
    // The tracked link: mints a fresh claim token on visit and counts the open.
    claimUrl: withRef(`${base}/go/${input.prospectId}`, input.code),
  };
}

/** The message a rep sends after building — short, true, and theirs to edit before sending. */
export function repSmsDraft(input: { repName: string; businessName: string; previewUrl: string }): string {
  return (
    `Hi, this is ${input.repName}. I put together a first version of a website for ${input.businessName}, no charge — ` +
    `have a look: ${input.previewUrl} If you'd like it, it's yours; if not, no problem at all.`
  );
}

/**
 * The message for a restaurant that already HAS a site: the draft is an ordering page to link
 * from it, never a replacement for the site they paid for. Says so in the first sentence.
 */
export function repOrderingSmsDraft(input: { repName: string; businessName: string; previewUrl: string }): string {
  return (
    `Hi, this is ${input.repName}. Your website stays as it is — I set up an online ordering page for ${input.businessName} ` +
    `from your own menu that you could link from it, no monthly fee: ${input.previewUrl} Have a look; if it's not for you, no problem at all.`
  );
}

/** `sms:` URL that opens the phone's messaging app with the draft filled in. */
export function smsHref(phone: string | null | undefined, body: string): string {
  const digits = String(phone ?? '').replace(/[^0-9+]/g, '');
  const to = digits ? (digits.startsWith('+') ? digits : `+1${digits.replace(/^1/, '')}`) : '';
  return `sms:${to}?&body=${encodeURIComponent(body)}`;
}
