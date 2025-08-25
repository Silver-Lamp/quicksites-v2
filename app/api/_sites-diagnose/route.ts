import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

const SELECT =
  'id, slug, template_name, domain_lc, published, is_site, archived';

export async function GET() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').toLowerCase().replace(/\.$/, '');
  const variants = host.startsWith('www.') ? [host, host.slice(4)] : [host, `www.${host}`];

  const s1 = await getServerSupabase();
  const ssr = await s1
    .from('templates').select(SELECT)
    .eq('is_site', true).eq('published', true).eq('archived', false)
    .in('domain_lc', variants).maybeSingle();

  const admin = await supabaseAdmin
    .from('templates').select(SELECT)
    .eq('is_site', true).eq('published', true).eq('archived', false)
    .in('domain_lc', variants).maybeSingle();

  return NextResponse.json({
    host, variants,
    env: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      baseDomain: process.env.NEXT_PUBLIC_BASE_DOMAIN,
    },
    ssr: { found: !!ssr.data, error: ssr.error?.message ?? null, row: ssr.data ?? null },
    admin: { found: !!admin.data, error: admin.error?.message ?? null, row: admin.data ?? null },
  });
}
