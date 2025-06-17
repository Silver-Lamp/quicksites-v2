import type { NextApiRequest, NextApiResponse } from 'next';
import { json } from '@/lib/api/json';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { domain, template, city, state } = req.body;

  if (!domain || !template || !city || !state) {
    return json({ error: 'Missing required fields' });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase.auth.getUser();
  const email = data?.user?.email || 'anonymous';

  const { error } = await supabase.from('regeneration_queue').insert([
    {
      domain,
      template_id: template,
      city,
      state,
      status: 'queued',
      triggered_by: email,
    },
  ]);

  if (error) return json({ error: error.message });

  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/run-next-job`, {
      method: 'POST',
    });
  } catch (err) {
    console.error('Auto-start error:', err);
  }

  return json({ message: 'Queued and triggered', triggered_by: email });
}
