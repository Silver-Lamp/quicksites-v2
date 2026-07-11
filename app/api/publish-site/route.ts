export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { requireAdmin } from '@/lib/auth/requireUser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!
);

export async function POST(req: Request) {
  // Was unauthenticated — anyone could publish any domain to public_sites. This
  // is the legacy publish path (no callers); lock it to platform admins.
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const { domain } = await req.json();

  if (!domain) {
    return json({ error: 'Missing domain' }, { status: 400 });
  }

  const { data: site } = await supabase
    .from('domains')
    .select('id, domain, template_id, data')
    .eq('domain', domain)
    .maybeSingle();

  if (!site) {
    return json({ error: 'Domain not found' }, { status: 404 });
  }

  await supabase.from('public_sites').upsert({
    id: site.id,
    domain: site.domain,
    template_id: site.template_id,
    data: site.data,
    published: true,
    updated_at: new Date().toISOString(),
  });

  return json({ success: true });
}
