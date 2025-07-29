// lib/gsc/getAllValidOAuthClients.ts
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library'; 
import { createClient } from '@supabase/supabase-js';

type GSCClientEntry = {
  domain: string;
  oauth2Client: OAuth2Client;
  error?: string;
};

export async function getAllValidOAuthClients(): Promise<GSCClientEntry[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: tokens, error } = await supabase
    .from('gsc_tokens')
    .select('domain, access_token, refresh_token, expiry');

  if (!tokens || error) {
    throw new Error('Failed to fetch GSC tokens');
  }

  const results: GSCClientEntry[] = [];

  for (const token of tokens) {
    try {
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
          .eq('domain', token.domain);
      }
      console.log('GSC Client Domain:', token.domain);
      results.push({ domain: token.domain, oauth2Client });
    } catch (err: any) {
      console.log('GSC Client Error:', err.message);
      results.push({ domain: token.domain, oauth2Client: null as any, error: err.message });
    }
  }

  return results;
}
