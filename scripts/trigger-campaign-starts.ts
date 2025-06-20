import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'upcoming')
    .lte('starts_at', new Date().toISOString());

  for (const campaign of campaigns || []) {
    console.log(`🚦 Starting campaign: ${campaign.name}`);

    await supabase.from('campaigns').update({ status: 'active' }).eq('id', campaign.id);

    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('id', campaign.lead_ids || []);

    for (const lead of leads || []) {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/leads/send-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead }),
      });

      await supabase.from('user_action_logs').insert([
        {
          lead_id: lead.id,
          domain_id: lead.domain_id,
          action_type: 'campaign_kickoff',
          triggered_by: 'campaign_bot',
        },
      ]);
    }
  }
}

run();
