// scripts/verifyDomainOwnership.ts
import { createClient } from '@supabase/supabase-js';
import { Resolver } from 'dns/promises';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_TOKEN = process.env.QS_DOMAIN_TXT_TOKEN || 'quicksites';

function normalizeApex(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .replace(/\.$/, '');
}

const DOMAIN_RX = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

async function resolveTXTAll(name: string): Promise<string[]> {
  const r = new Resolver();
  // Prefer public resolvers to reduce local caching issues
  r.setServers(['1.1.1.1', '8.8.8.8', '9.9.9.9']);
  try {
    const recs = await r.resolveTxt(name);
    // flatten: string[][]
    return recs.flat().map((s) => String(s));
  } catch {
    return [];
  }
}

export async function verifyTXT(apex: string, expectedTokens: string[] = [DEFAULT_TOKEN]): Promise<boolean> {
  const host = `_verify.${apex}`;
  const txts = (await resolveTXTAll(host)).map((s) => s.toLowerCase());
  const expected = expectedTokens.map((t) => String(t).toLowerCase()).filter(Boolean);
  if (!expected.length) return false;
  return expected.some((tok) => txts.some((val) => val.includes(tok)));
}

// Example usage (CLI + script)
if (require.main === module) {
  (async () => {
    const arg = process.argv[2] || '';
    const apex = normalizeApex(arg);
    if (!apex || !DOMAIN_RX.test(apex)) {
      console.error('Usage: node scripts/verifyDomainOwnership.ts example.com');
      process.exit(2);
    }

    const ok = await verifyTXT(apex);
    if (ok) {
      console.log(`✅ TXT verified for _verify.${apex}`);
      try {
        await supabase.from('templates').update({ verified: true }).eq('custom_domain', apex);
      } catch (e) {
        console.warn('Supabase update warning:', (e as Error)?.message);
      }
      process.exit(0);
    } else {
      console.log(`❌ TXT not found for _verify.${apex} (expected token includes "${DEFAULT_TOKEN}")`);
      process.exit(1);
    }
  })();
}
