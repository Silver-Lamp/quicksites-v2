/* app/admin/campaigns/page.tsx */

import { supabase } from '@/admin/lib/supabaseClient';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import { CampaignsClientPage } from '@/components/admin/pages/CampaignsClientPage';

export default async function CampaignsPage() {

  const today = new Date();
  const range = {
    from: startOfDay(subDays(today, 7)),
    to: endOfDay(today),
  };

  const { data: events = [] } = await supabase
    .from('guest_upgrade_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  const { data: logs = [] } = await supabase
    .from('user_action_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);

  return (
    <main className="max-w-6xl mx-auto p-6">
      <CampaignsClientPage
        events={events}
        logs={logs}
        defaultRange={range}
      />
    </main>
  );
}
