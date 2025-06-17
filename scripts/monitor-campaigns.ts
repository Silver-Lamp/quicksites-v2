import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const now = dayjs();
  const soon = now.add(1, 'hour').toISOString();

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .or(
      `and(status.eq.active,ends_at.lte.${soon}),and(status.eq.active,ends_at.lte.${now.toISOString()})`
    );

  for (const c of campaigns || []) {
    const { data: leads } = await supabase
      .from('leads')
      .select('*, domains(is_claimed)')
      .in('id', c.lead_ids || []);

    const claimed = leads?.find((l) => l.domains?.is_claimed);
    const isExpired = now.isAfter(c.ends_at);

    if (!claimed) {
      const status = isExpired
        ? '❌ Ended – no claim'
        : '⏰ 1h warning – no claim';

      await supabase.from('user_action_logs').insert([
        {
          action_type: 'campaign_alert',
          triggered_by: 'campaign_bot',
          notes: `${status}: ${c.name}`,
        },
      ]);

      const to = [c.created_by || '', 'sandonjurowski@gmail.com'].filter(
        Boolean
      );
      const subject = `Campaign Alert: ${c.name} (${c.city})`;
      const body = `Campaign "${c.name}" is ${status}.
City: ${c.city}
Start: ${c.starts_at}
End: ${c.ends_at}

No claims detected from:
${(leads || []).map((l) => '- ' + l.business_name).join('\n')}`;

      to.forEach((email) => {
        console.log('📧 MOCK EMAIL');
        console.log('To:', email);
        console.log('Subject:', subject);
        console.log('Body:', body);
        console.log('---');
      });
    }
  }
}

run();
