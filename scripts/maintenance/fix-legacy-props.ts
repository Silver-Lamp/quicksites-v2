// scripts/maintenance/fix-legacy-props.ts
import { createClient } from '@supabase/supabase-js';
import { upgradeLegacyBlocksDeep } from '@/app/api/dev/seed/_lib/upgradeLegacyBlocks';

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY  = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);

if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(URL, KEY, { auth: { persistSession: false } });

async function run() {
  let from = 0, page = 500, updated = 0;
  while (true) {
    const { data, error } = await admin.from('templates').select('id,data').range(from, from+page-1);
    if (error) throw error;
    if (!data?.length) break;

    for (const row of data) {
      const d = row?.data;
      if (!d) continue;
      const hasProps = JSON.stringify(d).includes('"props":');
      if (!hasProps) continue;
      const next = upgradeLegacyBlocksDeep(d);
      await admin.from('templates').update({ data: JSON.stringify(next) }).eq('id', row.id);
      updated++;
    }
    from += page;
  }
  console.log('Updated', updated, 'templates.');
}

run().catch(console.error);
