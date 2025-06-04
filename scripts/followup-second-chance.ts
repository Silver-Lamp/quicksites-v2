import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const since = dayjs().subtract(48, 'hour').toISOString();

  const { data: clicks } = await supabase
    .from('user_action_logs')
    .select('*, leads(id, domain_id, email, business_name), domains(is_claimed)')
    .eq('action_type', 'click_second_chance')
    .gte('timestamp', since);

  for (const log of clicks || []) {
    const { domain_id, lead_id } = log;

    const { data: domain } = await supabase
      .from('domains')
      .select('is_claimed')
      .eq('id', domain_id)
      .maybeSingle();

    if (domain?.is_claimed) continue;

    const { data: alreadySent } = await supabase
      .from('user_action_logs')
      .select('*')
      .eq('action_type', 'second_chance_followup')
      .eq('lead_id', lead_id)
      .maybeSingle();

    if (alreadySent) continue;

    const alt = 'your-second-site.com';

    console.log('📧 FOLLOW-UP EMAIL');
    console.log('To:', log.triggered_by);
    console.log('Subject: Still Interested?');
    console.log(`Body: You clicked on your reserved site but haven’t claimed it yet. Still interested? https://${alt}`);

    await supabase.from('user_action_logs').insert([
      {
        lead_id,
        domain_id,
        action_type: 'second_chance_followup',
        triggered_by: 'campaign_bot',
        notes: `Follow-up for ${alt}`
      }
    ]);
  }
}

run();
