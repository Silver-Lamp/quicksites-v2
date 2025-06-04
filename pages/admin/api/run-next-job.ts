import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { data, error } = await supabase
    .from('regeneration_queue')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ message: 'No queued jobs' });

  const job = data;
  const startTime = new Date().toISOString();
  await supabase
    .from('regeneration_queue')
    .update({ status: 'processing', started_at: startTime })
    .eq('id', job.id);

  const scriptPath = path.resolve(process.cwd(), '../init.js');
  const command = `node ${scriptPath} "${job.city}" "${job.state}" "${job.template_id}" --push-to-github`;

  exec(command, async (err, stdout, stderr) => {
    const finishTime = new Date().toISOString();
    const update = {
      finished_at: finishTime,
      status: err ? 'error' : 'done',
      log: err ? stderr : stdout
    };
    await supabase.from('regeneration_queue').update(update).eq('id', job.id);
  });

  return res.status(200).json({ message: 'Job started', job: job.domain });
}
