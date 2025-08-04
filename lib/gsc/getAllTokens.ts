import { supabase } from "@/admin/lib/supabaseClient";
import { refreshGSC } from "./refreshToken";

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
  