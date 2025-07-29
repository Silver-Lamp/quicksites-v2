// lib/gsc/getValidOAuthClient.ts
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export async function getValidOAuthClient(domain: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    process.env.GSC_CLIENT_ID!,
    process.env.GSC_CLIENT_SECRET!
  );

  oauth2Client.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expiry_date: token.expiry ? new Date(token.expiry).getTime() : undefined,
  });

  const isExpired =
    !token.expiry || new Date(token.expiry).getTime() <= Date.now() + 60_000;

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
