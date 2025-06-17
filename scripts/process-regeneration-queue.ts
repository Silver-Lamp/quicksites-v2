import 'dotenv/config';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  const { data: job, error } = await supabase
    .from('regeneration_queue')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!job) {
    console.log('✅ No queued jobs.');
    return;
  }

  console.log('🔄 Running job for:', job.domain);
  await supabase
    .from('regeneration_queue')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', job.id);

  try {
    const cmd = `node ../init.js "${job.city}" "${job.state}" "${job.template_id}" --push-to-github`;
    const output = execSync(cmd, { encoding: 'utf-8' });

    await supabase
      .from('regeneration_queue')
      .update({
        status: 'done',
        finished_at: new Date().toISOString(),
        log: output,
      })
      .eq('id', job.id);

    await supabase.from('user_action_logs').insert([
      {
        domain_id: job.domain_id,
        action_type: 'regeneration_complete',
        triggered_by: job.triggered_by || 'queue_bot',
      },
    ]);

    console.log('✅ Job complete.');
  } catch (err: any) {
    console.error('❌ Job failed:', err.message);

    await supabase
      .from('regeneration_queue')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        log: err.message,
      })
      .eq('id', job.id);
  }
}

run();
