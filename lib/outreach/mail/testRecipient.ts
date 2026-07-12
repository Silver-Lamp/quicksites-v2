// lib/outreach/mail/testRecipient.ts
//
// A single, persisted "mail my live test here" address (public.site_settings, service-role
// only). When a postcard send is run in test mode, ONE real personalized piece is mailed to
// this address instead of the actual prospects — so you can validate the full pipeline
// (render → Lob → delivery webhook → scan) end to end without touching a real business.

import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';

export const TEST_RECIPIENT_KEY = 'outreach_test_recipient';

export type TestRecipient = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip: string;
};

function valid(r: any): r is TestRecipient {
  return !!(r && r.line1 && r.city && r.state && r.zip);
}

/** The configured live-test address, or null when unset. */
export async function getTestRecipient(): Promise<TestRecipient | null> {
  const v = await getSiteSetting<TestRecipient | null>(TEST_RECIPIENT_KEY, null);
  return valid(v)
    ? { name: v.name || 'Test Recipient', line1: v.line1, line2: v.line2 ?? null, city: v.city, state: v.state, zip: v.zip }
    : null;
}

/** Set (or clear with null) the live-test address. Admin-gated at the call site. */
export async function setTestRecipient(r: TestRecipient | null, updatedBy?: string | null): Promise<void> {
  if (r !== null && !valid(r)) throw new Error('Test recipient needs line1, city, state, and zip.');
  await setSiteSetting(TEST_RECIPIENT_KEY, r, updatedBy);
}
