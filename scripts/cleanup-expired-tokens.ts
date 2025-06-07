import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data, error } = await supabase
  .from('report_tokens')
  .delete()
  .lt('expires_at', new Date().toISOString());

if (error) {
  console.error('❌ Failed to clean expired tokens:', error);
} else {
  console.log(`🧼 Deleted ${data?.length || 0} expired tokens`);
}
