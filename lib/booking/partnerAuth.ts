// lib/booking/partnerAuth.ts
//
// HiveJournal's floor plan calls the booking routes server-to-server
// (crosstalk/contracts/restaurant-floor-plan.md). Same scheme as artist-profile.md:
// `X-Partner-Id: hivejournal` + `X-Partner-Signature` = hex HMAC-SHA256 with the shared
// PARTNER_QUICKSITES_SECRET over
//   GET  → the request's `pathname + search` exactly as sent (`/api/booking/<id>/day?date=…`)
//   POST → the raw request body bytes, exactly as sent (parse AFTER verifying)
// A request without the partner header is not a partner request and falls through to the
// owner-session gate; a partner header with a bad signature is refused outright (never
// downgraded to a session check — a forged header must not reach a weaker gate).
import type { NextRequest } from 'next/server';
import { verifyPartnerSignature } from '@/lib/partners/artistSite';

export const BOOKING_PARTNER_ID = 'hivejournal';

export type PartnerCheck = 'not_partner' | 'ok' | 'bad_signature';

export function checkBookingPartner(req: NextRequest, signedInput: string): PartnerCheck {
  if (req.headers.get('x-partner-id') !== BOOKING_PARTNER_ID) return 'not_partner';
  return verifyPartnerSignature(signedInput, req.headers.get('x-partner-signature'), process.env.PARTNER_QUICKSITES_SECRET) ? 'ok' : 'bad_signature';
}
