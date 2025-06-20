import { supabase } from '@/admin/lib/supabaseClient';
import { sendToSlack } from './sendToSlack';

const SLACK_WEBHOOK_URL = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL;

export async function logWithSlack(profileId: string, event: string, details: string = '') {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id || null;
  const email = user?.user?.email || 'unknown';

  await supabase.from('branding_logs').insert([
    {
      profile_id: profileId,
      user_id: userId,
      event,
      details,
    },
  ]);

  if (SLACK_WEBHOOK_URL) {
    const msg = `📢 Branding Event: ${event}
• Profile ID: ${profileId}
• User: ${email}
• Details: ${details}`;
    await sendToSlack(msg, SLACK_WEBHOOK_URL);
  }
}
