import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(_req, res) {
  const { data, error } = await supabase
    .from('digest_emails_sent')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error });

  res.status(200).json(data);
}
