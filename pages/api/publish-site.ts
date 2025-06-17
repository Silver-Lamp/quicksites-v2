import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { domain } = JSON.parse(req.body);

  const { data: site } = await supabase
    .from('domains')
    .select('id, domain, template_id, data')
    .eq('domain', domain)
    .maybeSingle();

  if (!site) return json({ error: 'Domain not found' });

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
