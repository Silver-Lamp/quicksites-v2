import { createClient } from '@supabase/supabase-js';
import dns from 'dns/promises';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function verifyTXT(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(`_verify.${domain}`);
    const flat = records.flat().join('');
    return flat.includes('quicksites');
  } catch {
    return false;
  }
}

// Example use
(async () => {
  const domain = 'example.com';
  const verified = await verifyTXT(domain);
  if (verified) {
    console.log('✅ Domain verified!');
    await supabase.from('templates').update({ verified: true }).eq('custom_domain', domain);
  } else {
    console.log('❌ Domain not verified.');
  }
})();
