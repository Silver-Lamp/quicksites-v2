// admin/lib/logWithSlack.ts
// Use logWithSlack() when you need to log an event to Slack
// Use getUserFromRequest() when you need the user context

import { supabase } from '@/admin/lib/supabaseClient';
import { sendToSlack } from './sendToSlack';

const SLACK_WEBHOOK_URL = process.env.NEXT_PUBLIC_SLACK_WEBHOOK_URL;

export async function logWithSlack(profileId: string, event: string, details: string = '') {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const userId = user?.id ?? null;
  const email = user?.email ?? 'unknown';

  // ✅ Optional logging
  if (error) {
    console.warn('[logWithSlack] Could not fetch user:', error.message);
  }

  // ✅ Save to Supabase
  const { error: insertError } = await supabase.from('branding_logs').insert({
    profile_id: profileId,
    user_id: userId,
    event,
    details,
  });

  if (insertError) {
    console.error('[logWithSlack] Failed to insert branding log:', insertError.message);
  }

  // ✅ Optional Slack ping
  if (SLACK_WEBHOOK_URL) {
    const msg = `📢 Branding Event: *${event}*
• Profile ID: \`${profileId}\`
• User: \`${email}\`
• Details: ${details || '_none_'}`;

    try {
      await sendToSlack(msg, SLACK_WEBHOOK_URL);
    } catch (err) {
      console.warn('[logWithSlack] Slack webhook failed:', (err as Error).message);
    }
  }
}
