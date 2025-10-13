import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

process.on('unhandledRejection', (e) => { console.error('UNHANDLED REJECTION:', e); process.exit(1); });
process.on('uncaughtException', (e) => { console.error('UNCAUGHT EXCEPTION:', e); process.exit(1); });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TARGET_SLUG = process.env.TEMPLATE_SLUG || 'pnw-prestige-cleaning';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

type J = any;
const EA = new Set(['exterior_agency', 'exterior_cleaning_agency', 'pnw_prestige']);

function flattenBlock(b: J): J {
  if (!b || typeof b !== 'object') return b;
  if (EA.has(String(b.type)) && b.props && typeof b.props === 'object') {
    const p = b.props;
    const flattened = p && typeof p.content === 'object' ? p.content : p;
    return { ...b, props: flattened };
  }
  return b;
}
function flattenPage(p: J): J {
  const blocks = Array.isArray(p?.content_blocks) ? p.content_blocks : [];
  return { ...p, content_blocks: blocks.map(flattenBlock) };
}

async function main() {
  console.log('▶️  Migrating via commit_template for slug:', TARGET_SLUG);

  const { data: tpl, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', TARGET_SLUG)
    .maybeSingle();

  if (error) throw error;
  if (!tpl) throw new Error('Template not found');

  const pages: J[] = tpl.data?.pages || tpl.pages || [];
  const newPages = pages.map(flattenPage);

  // Commit through RPC (your DB wrapper turns ops → app.commit_template payload)
  const ops = [
    { op: 'set', path: 'data.pages', value: newPages },
  ];

  const { data: rpcData, error: rpcErr } = await supabase.rpc('commit_template', {
    p_template_id: tpl.id,
    p_ops: ops as J,
    p_message: 'migration: flatten exterior agency props → content',
    p_kind: 'migration',
    p_base_rev: tpl.rev ?? null,
    p_actor: null,
  });

  if (rpcErr) {
    console.error('❌ RPC commit_template failed:', rpcErr);
    process.exit(1);
  }

  console.log('✅ commit_template applied', rpcData ?? '');
}

main().catch((e) => { console.error('❌ Fatal:', e); process.exit(1); });
