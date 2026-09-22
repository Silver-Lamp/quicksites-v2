// lib/gsc/getValidOAuthClient.ts
import { google } from 'googleapis';
import { gscClientId, gscClientSecret } from '@/lib/gsc/oauthConfig';
import { createClient } from '@supabase/supabase-js';

/**
 * Parse a stored expiry. A zone-less timestamp is UTC by our own convention (the column is
 * timestamptz since migration 20260849, but a row written before it — or any other naive column
 * read into this code — must not be read as local time). Getting this wrong does not throw: it
 * makes an expired token look valid, the refresh never fires, and every GSC call 401s.
 */
export function parseExpiry(value: string | number | Date | null | undefined): number | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const s = String(value).trim();
  if (!s) return undefined;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const t = new Date(hasZone ? s : `${s.replace(' ', 'T')}Z`).getTime();
  return Number.isFinite(t) ? t : undefined;
}

export async function getValidOAuthClient(domain: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
  );

  const { data: token, error } = await supabase
    .from('gsc_tokens')
    .select('*')
    .eq('domain', domain)
    .maybeSingle();

  if (!token || error) {
    throw new Error('No GSC token found for domain');
  }

  const oauth2Client = new google.auth.OAuth2(
    gscClientId(),
    gscClientSecret()
  );

  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: parseExpiry(token.expiry),
  });

  const expiresAt = parseExpiry(token.expiry);
  const isExpired = expiresAt == null || expiresAt <= Date.now() + 60_000;

  if (isExpired) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    await supabase
      .from('gsc_tokens')
      .update({
        access_token: credentials.access_token,
        expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      })
      .eq('domain', domain);
  }

  return oauth2Client;
}
