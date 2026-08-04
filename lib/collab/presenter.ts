// lib/collab/presenter.ts
//
// Who is asking the client to make this decision.
//
// ⚠️ THIS IS ATTRIBUTION, NOT BRANDING, AND THE DISTINCTION DECIDES WHAT GOES IN IT. The collab
// page is opened from a forwarded link by someone with no account, about their own business. A
// page that asks for a decision and carries nobody's name is the same defect we refuse everywhere
// else in this repo — an AI reviewer must say it is an AI, a narrator must say it is a narrator,
// and the sender must say who they are. The cold mesh poll (crosstalk 2026-08-04, PorchHearth +
// DeckSketch independently) landed on exactly this framing: chrome that describes the transaction
// is honest, chrome that dresses the vendor is not.
//
// ⚠️ THE TITLE IS DELIBERATELY DROPPED. The source record is the COLD-POSTCARD sender profile —
// marketing material. A name and a face carry the same meaning in both places; a title is written
// for outreach optics and reads differently on a real client's decision page. Same asset, different
// claim. If a title is ever wanted here it should be a field of its own, entered for this purpose.
//
// ⚠️ SINGULAR, NEVER PLURAL. No "our team", no "your producer". It is one person and some models,
// and a page implying a staff is the invented-staff-roster failure (CUSTOM_SITES §4 rule 4) in a
// nicer font.

import type { SenderProfile } from '@/lib/outreach/senderProfile';

export type Presenter = {
  /** The human being's actual name. Required — a presenter with no name is not a presenter. */
  name: string;
  /** A way to reach them that is not the composer on this page. */
  email: string | null;
  headshotUrl: string | null;
};

/**
 * Map the stored sender profile to the identity shown on a client's collab page.
 *
 * Returns null when there is no name, and the caller renders NO identity block rather than an
 * empty one — a header with a blank human is worse than no header, because it reads as a page
 * that failed to load rather than a page that never claimed anything.
 */
export function presenterFromSenderProfile(p: SenderProfile | null | undefined): Presenter | null {
  const name = p?.name?.trim();
  if (!name) return null;
  return {
    name,
    email: p?.email?.trim() || null,
    headshotUrl: p?.headshotUrl?.trim() || null,
  };
}
