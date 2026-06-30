import { createClient } from '@supabase/supabase-js';
import { refreshGSC } from "./refreshToken";

// Service-role client: gsc_tokens holds OAuth tokens and is RLS-locked (no anon
// access). This is a server-only module, so use the service role like the rest of
// lib/gsc/*. (Was using the public anon client, which only worked while RLS was off.)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
  { auth: { persistSession: false } },
);

// lib/gsc/refreshToken.ts (append or split to getAllTokens.ts)
export async function getAllValidGscTokens(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from('gsc_tokens')
      .select('domain');
  
    if (error || !data) {
      throw new Error('Failed to fetch domains from gsc_tokens');
    }
  
    const tokens: Record<string, string> = {};
  
    for (const { domain } of data) {
      try {
        const token = await refreshGSC(domain);
        tokens[domain] = token;
      } catch (err) {
        console.warn(`[gsc] Failed to get token for ${domain}:`, (err as Error).message);
      }
    }
  
    return tokens;
  }
  