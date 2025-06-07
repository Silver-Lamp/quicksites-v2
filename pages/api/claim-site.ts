import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req, res) {
  const { slug, email, anon } = JSON.parse(req.body);

  const { data: domain } = await supabase
    .from('domains')
    .select('*')
    .eq('domain', slug)
    .maybeSingle();

  if (!domain || domain.is_claimed) {
    return res.status(400).json({ error: 'Already claimed' });
  }

  const updates = {
    is_claimed: true,
    ...(anon ? {} : { claimed_email: email }),
  };

  await supabase.from('domains').update(updates).eq('domain', slug);

  await supabase.from('screenshot_queue').insert({ domain: slug });

  if (!anon) {
    await supabase.from('steward_rewards').insert({
      user_id: null, // future link to email/user
      site_domain: slug,
      reason: 'initial_claim',
      points: 5,
    });
  }

  return res.status(200).json({ success: true });
}
