// lib/gsc/oauthConfig.ts
//
// Shared Google OAuth config for the GSC connect flow. The /api/gsc/auth-url and
// /api/gsc/oauth-callback routes MUST use the SAME client id + redirect URI or
// Google rejects the token exchange. Historically they drifted: auth-url
// hardcoded a localhost redirect and read GOOGLE_CLIENT_ID (unset in prod, where
// lib/gsc/* uses GSC_CLIENT_ID) — producing client_id=undefined & a localhost URI.
// This centralizes both and tolerates either env naming convention.

export function gscClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || process.env.GSC_CLIENT_ID || '';
}

export function gscClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.GSC_CLIENT_SECRET || '';
}

/**
 * App origin used to build the OAuth redirect URI. This value must be registered
 * as an authorized redirect in the Google Cloud console. Defaults to the prod
 * host in production and localhost otherwise; override with GSC_BASE_URL.
 */
export function gscBaseUrl(): string {
  const raw =
    process.env.GSC_BASE_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://www.quicksites.ai' : 'http://localhost:3000');
  return raw.replace(/\/+$/, '');
}

export function gscRedirectUri(): string {
  return `${gscBaseUrl()}/api/gsc/oauth-callback`;
}
