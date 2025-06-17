import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .is('winner_lead_id', null);

  for (const c of campaigns || []) {
    const { data: leads } = await supabase
      .from('leads')
      .select('*, domains(domain, is_claimed)')
      .in('id', c.lead_ids || []);

    const claimed = leads?.find((l) => l.domains?.is_claimed);
    const unclaimed = leads?.filter((l) => !l.domains?.is_claimed) || [];

    if (!claimed || unclaimed.length === 0) continue;

    // Notify unclaimed leads
    unclaimed.forEach((lead, i) => {
      const altDomain = c.alt_domains?.[i] || 'your-second-site.com';

      const subject = `⏳ You’ve Got a Second Chance`;
      const body = `Hey ${lead.business_name}, the first site was claimed — but we’ve reserved a second domain just for you: https://${altDomain}

You can still claim it this week. Let us know!`;

      console.log('📧 MOCK SECOND CHANCE');
      console.log('To:', lead.email || '(no email)');
      console.log('Subject:', subject);
      console.log('Body:', body);
      console.log('---');

      supabase.from('user_action_logs').insert([
        {
          lead_id: lead.id,
          domain_id: lead.domain_id,
          action_type: 'second_chance_offered',
          triggered_by: 'campaign_bot',
          notes: `Sent alt domain: ${altDomain}`,
        },
      ]);
    });
  }
}

run();
