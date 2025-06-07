import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { domain } = JSON.parse(req.body);

  const { data: site } = await supabase
    .from('domains')
    .select('id, domain, template_id, data')
    .eq('domain', domain)
    .maybeSingle();

  if (!site) return res.status(404).json({ error: 'Domain not found' });

  await supabase.from('public_sites').upsert({
    id: site.id,
    domain: site.domain,
    template_id: site.template_id,
    data: site.data,
    published: true,
    updated_at: new Date().toISOString(),
  });

  return res.status(200).json({ success: true });
}
