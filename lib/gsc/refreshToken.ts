// lib/gsc/refreshToken.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function refreshGSC(domain: string): Promise<string> {
  const { data, error } = await supabase
    .from('gsc_tokens')
    .select('*')
    .eq('domain', domain)
    .single();

  if (error || !data) {
    throw new Error(`No token record found for domain: ${domain}`);
  }

  const { access_token, refresh_token, expiry } = data;

  const isExpired =
    !expiry || new Date(expiry).getTime() <= Date.now() + 60 * 1000; // 1-minute buffer

  if (!isExpired && access_token) {
    return access_token;
  }

  if (!refresh_token) {
    throw new Error(`Access token expired and no refresh_token found for domain: ${domain}`);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Failed to refresh token: ${JSON.stringify(json)}`);
  }

  const newExpiry = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await supabase
    .from('gsc_tokens')
    .update({
      access_token: json.access_token,
      expiry: newExpiry,
    })
    .eq('domain', domain);

  return json.access_token;
}
