// lib/outreach/senderProfile.ts
//
// The operator's "who's contacting you" identity for cold outreach — the human sign-off on
// the postcard (headshot + signature + name) and the "questions?" contact email shown on the
// postcard AND the claim landing page. Stored in public.site_settings (service-role only, RLS
// denied); env vars remain a fallback so an existing POSTCARD_SENDER_* setup keeps working.
//
// This is a GLOBAL, default-brand identity. Reseller/white-label sends suppress the personal
// sign-off (see senderFromProfile) so a partner's card never carries the platform operator.

import { getSiteSetting, setSiteSetting } from '@/lib/settings/siteSettings';

export const SENDER_PROFILE_KEY = 'outreach_sender_profile';

export type SenderProfile = {
  name: string | null;
  title: string | null;
  email: string | null;
  headshotUrl: string | null;
  signatureUrl: string | null;
  /** Business city/state — drives the "local to me" signal on the card. */
  city: string | null;
  state: string | null;
  /** Optional coordinates — enable the cross-state proximity radius. */
  lat: number | null;
  lng: number | null;
};

/** The stored (DB) shape — everything optional; unset fields fall back to env. */
export type SenderProfileInput = Partial<Record<keyof SenderProfile, string | number | null>>;

const EMPTY: SenderProfile = {
  name: null, title: null, email: null, headshotUrl: null, signatureUrl: null,
  city: null, state: null, lat: null, lng: null,
};

function str(v: unknown): string | null {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}
function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Basic email sanity — enough to catch typos before we print it on mail. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Env fallback so a pre-existing POSTCARD_SENDER_* / LOB_FROM_* config keeps working. */
function envProfile(): SenderProfile {
  return {
    name: str(process.env.POSTCARD_SENDER_NAME),
    title: str(process.env.POSTCARD_SENDER_TITLE),
    email: str(process.env.POSTCARD_SENDER_EMAIL),
    headshotUrl: str(process.env.POSTCARD_SENDER_HEADSHOT_URL),
    signatureUrl: str(process.env.POSTCARD_SENDER_SIGNATURE_URL),
    city: str(process.env.POSTCARD_SENDER_CITY) ?? str(process.env.LOB_FROM_CITY),
    state: str(process.env.POSTCARD_SENDER_STATE) ?? str(process.env.LOB_FROM_STATE),
    lat: num(process.env.POSTCARD_SENDER_LAT),
    lng: num(process.env.POSTCARD_SENDER_LNG),
  };
}

/** Normalize a stored/env record into a full SenderProfile. */
function normalize(v: Partial<SenderProfile> | null | undefined): SenderProfile {
  return {
    name: str(v?.name),
    title: str(v?.title),
    email: str(v?.email),
    headshotUrl: str(v?.headshotUrl),
    signatureUrl: str(v?.signatureUrl),
    city: str(v?.city),
    state: str(v?.state),
    lat: num(v?.lat),
    lng: num(v?.lng),
  };
}

/**
 * The resolved sender profile: each field from the DB, falling back to env per-field. So an
 * operator can set just the name+email in the UI and still inherit a city/state from LOB_FROM_*.
 */
export async function getSenderProfile(): Promise<SenderProfile> {
  const stored = normalize(await getSiteSetting<Partial<SenderProfile> | null>(SENDER_PROFILE_KEY, null));
  const env = envProfile();
  const pick = <K extends keyof SenderProfile>(k: K): SenderProfile[K] => (stored[k] ?? env[k]) as SenderProfile[K];
  return {
    name: pick('name'), title: pick('title'), email: pick('email'),
    headshotUrl: pick('headshotUrl'), signatureUrl: pick('signatureUrl'),
    city: pick('city'), state: pick('state'), lat: pick('lat'), lng: pick('lng'),
  };
}

/** Persist the sender profile (admin-gated at the call site). Validates the email if present. */
export async function setSenderProfile(input: SenderProfileInput | null, updatedBy?: string | null): Promise<void> {
  if (input === null) {
    await setSiteSetting(SENDER_PROFILE_KEY, EMPTY, updatedBy);
    return;
  }
  const next = normalize({
    name: str(input.name), title: str(input.title), email: str(input.email),
    headshotUrl: str(input.headshotUrl), signatureUrl: str(input.signatureUrl),
    city: str(input.city), state: input.state != null ? String(input.state).trim().toUpperCase() : null,
    lat: num(input.lat), lng: num(input.lng),
  });
  if (next.email && !isValidEmail(next.email)) throw new Error('That email address looks invalid.');
  await setSiteSetting(SENDER_PROFILE_KEY, next, updatedBy);
}

/**
 * Is the profile complete enough to run a campaign? Name + email are the minimum: without them
 * a prospect can't tell who built their site or how to reach you. Used to alert before a send.
 */
export function senderProfileReady(p: SenderProfile): boolean {
  return !!(p.name && p.email && isValidEmail(p.email));
}
