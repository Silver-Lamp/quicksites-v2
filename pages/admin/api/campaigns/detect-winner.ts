import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_: NextApiRequest, res: NextApiResponse) {
  const { data: claims } = await supabase
    .from('user_action_logs')
    .select('*')
    .eq('action_type', 'site_claimed')
    .order('timestamp', { ascending: false })
    .limit(50);

  for (const log of claims || []) {
    const { data: leadMatch } = await supabase
      .from('leads')
      .select('id, campaign_id, domain_id, business_name, email')
      .eq('domain_id', log.domain_id)
      .maybeSingle();

    if (!leadMatch?.campaign_id) continue;

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, winner_lead_id, name, city')
      .eq('id', leadMatch.campaign_id)
      .maybeSingle();

    if (!campaign) {
      return json({ error: 'Campaign not found' });
    }

    await supabase
      .from('campaigns')
      .update({ winner_lead_id: leadMatch.id })
      .eq('id', campaign.id);

    const subject = `🏁 You Won: ${campaign.name}`;
    const body = `Hey ${leadMatch.business_name}, you were the first to claim your site in ${campaign.name} (${campaign.city}). Congrats!

Your site is live at: https://${log.domain_id || 'your-site.com'}`;

    console.log('📧 MOCK EMAIL');
    console.log('To:', leadMatch.email || '(no email)');
    console.log('Subject:', subject);
    console.log('Body:', body);
    console.log('---');

    await supabase.from('user_action_logs').insert([
      {
        lead_id: leadMatch.id,
        domain_id: leadMatch.domain_id,
        action_type: 'campaign_win',
        triggered_by: 'campaign_bot',
        notes: `Won ${campaign.name}`,
      },
    ]);
  }

  return json({ message: 'Campaign winner check complete' });
}
