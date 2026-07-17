// lib/walker/gigPost.ts
//
// Cross-post CONTENT generator for a cataloging gig (catalog_gigs) — turns a gig into
// ready-to-post copy + a QR code + a launcher URL per recruiting channel. See
// docs/AISLEASK_OPS_PLAN.md Feature B.
//
// HARD CONSTRAINT (baked in here so nobody mistakes it later): FB Marketplace + Craigslist
// have NO posting API and forbid automated posting. This module NEVER posts anywhere — it
// only *prepares* the post and *opens the form* (a human submits). The only truly-automatable
// external surface is an FB Page via the Graph API (needs a connected Page + owner setup);
// our own channels (public gigs page / feed / email / SMS) are automatable too. The launcher
// URLs below deep-link a human to the posting form; they do not carry credentials or submit.

import QRCode from 'qrcode';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';
import type { Gig } from '@/lib/walker/gigs';

export type PostChannel =
  | 'craigslist'
  | 'facebook_marketplace'
  | 'facebook_page'
  | 'gigs_page'
  | 'email'
  | 'sms'
  | 'other';

/** The public URL a cross-post links to — where a tasker sees the gig + claims it. */
export function gigPublicUrl(gig: Gig, base: string = publicBaseUrl()): string {
  return `${base.replace(/\/+$/, '')}/gigs/${gig.id}`;
}

/** Best available "where" string for a gig — precise-ish, human-readable. */
export function gigWhere(gig: Gig): string {
  if (gig.address) return gig.address;
  if (gig.location_label) return gig.location_label;
  if (Number.isFinite(gig.latitude) && Number.isFinite(gig.longitude))
    return `${gig.latitude}, ${gig.longitude}`;
  return 'a nearby store';
}

/** A short city-ish label from the address/location, for titles ("… — Austin, TX"). */
export function gigLocality(gig: Gig): string {
  const src = gig.location_label || gig.address || '';
  // Grab the "City, ST" tail of a formatted address if present.
  const m = src.match(/([A-Za-z .'-]+,\s*[A-Z]{2})\b/);
  if (m) return m[1].trim();
  return src.split(',').slice(-2).join(',').trim() || 'your area';
}

export type ChannelHints = {
  /** Craigslist section + posting category hint. */
  craigslistCategory?: string;
  /** FB Marketplace category hint. */
  marketplaceCategory?: string;
};

export type GigPostContent = {
  channel: PostChannel;
  title: string;
  body: string;
  url: string;
  hints: ChannelHints;
};

const PAY_LINE = (payNote?: string | null) =>
  payNote && payNote.trim()
    ? payNote.trim()
    : 'Flexible, pilot gig — see the listing for current terms.';

/**
 * Generate ready-to-post content for a gig + channel. `payNote` lets the operator state the
 * honest comp model (paid rate, or "pilot / unpaid" — §10 was payments-free v0; recruiting
 * for unpaid work must say so). Never fabricates pay.
 */
export function buildGigPost(
  gig: Gig,
  channel: PostChannel,
  opts: { payNote?: string | null; base?: string } = {}
): GigPostContent {
  const url = gigPublicUrl(gig, opts.base);
  const locality = gigLocality(gig);
  const where = gigWhere(gig);
  const pay = PAY_LINE(opts.payNote);

  const title = `Flexible gig: catalog a store's aisles — ${locality}`;

  // A shared, honest body; each channel gets a light framing tweak.
  const base = [
    `We're mapping the aisles of local stores and need someone to walk one and catalog it.`,
    ``,
    `The store: ${gig.store_name}`,
    `Where: ${where}`,
    `Time: about 15–30 minutes, on your own schedule.`,
    `What you do: walk the aisles in order and record what's in each section (we make this easy — no special skills needed).`,
    `Pay: ${pay}`,
    ``,
    `Claim this gig here: ${url}`,
  ].join('\n');

  let body = base;
  if (channel === 'craigslist') {
    body = `${base}\n\nReply through the link above to claim — first to claim gets it.`;
  } else if (channel === 'facebook_marketplace' || channel === 'facebook_page') {
    body = `🧺 ${title}\n\n${base}`;
  } else if (channel === 'sms') {
    // SMS: keep it tight.
    body = `Flexible ${locality} gig: walk & catalog a store's aisles (~20 min, ${gig.store_name}). ${pay} Claim: ${url}`;
  } else if (channel === 'email') {
    body = base;
  }

  const hints: ChannelHints = {
    craigslistCategory: 'gigs → labor/move (ggg)',
    marketplaceCategory: 'Miscellaneous / Services',
  };

  return { channel, title, body, url, hints };
}

/**
 * Assisted-post launcher URLs — these OPEN the posting form for a human to finish. They do
 * NOT submit. Craigslist can't be prefilled beyond the site; the human pastes title/body.
 */
export function launcherUrls(
  gig: Gig,
  base?: string
): {
  craigslist: string;
  facebookPageComposer: string;
  gigPublic: string;
} {
  const url = gigPublicUrl(gig, base);
  return {
    // Craigslist has no create-post deep link that survives; the account picker at
    // /post is the reliable entry. The operator picks their city + "gigs".
    craigslist: 'https://post.craigslist.org/',
    // FB Page composer prefilled with the gig link (a human hits Post). This is the sharer,
    // which works for a personal timeline or a Page the user manages.
    facebookPageComposer: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    gigPublic: url,
  };
}

/** A QR code (data URL) for the gig's public page — drop into a printed flyer / image post. */
export async function gigQrDataUrl(gig: Gig, base?: string): Promise<string> {
  return QRCode.toDataURL(gigPublicUrl(gig, base), { width: 600, margin: 1 });
}
