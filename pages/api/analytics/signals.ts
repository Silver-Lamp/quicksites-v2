import { createClient } from '@supabase/supabase-js';
import { json } from '@/lib/api/json';
import { NextApiRequest, NextApiResponse } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function groupByDate(data: any[], field: string) {
  const groups: Record<string, number> = {};
  for (const row of data) {
    const date = row[field].slice(0, 10); // YYYY-MM-DD
    groups[date] = (groups[date] || 0) + 1;
  }
  return Object.entries(groups).map(([date, count]) => ({ date, count }));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { start, end } = req.query;

  const viewRange = {
    from: start ? new Date(start as string).toISOString() : undefined,
    to: end ? new Date(end as string).toISOString() : undefined,
  };

  const [views, feedback] = await Promise.all([
    supabase
      .from('published_site_views')
      .select('viewed_at')
      .gte('viewed_at', viewRange.from || '')
      .lte('viewed_at', viewRange.to || ''),
    supabase
      .from('block_feedback')
      .select('created_at')
      .gte('created_at', viewRange.from || '')
      .lte('created_at', viewRange.to || ''),
  ]);

  if (views.error || feedback.error) {
    return json({ error: 'Error loading analytics' });
  }

  const byViews = groupByDate(views.data, 'viewed_at');
  const byFeedback = groupByDate(feedback.data, 'created_at');

  const merged: Record<string, any> = {};
  byViews.forEach(({ date, count }) => {
    merged[date] = { date, views: count, feedback: 0 };
  });
  byFeedback.forEach(({ date, count }) => {
    merged[date] = { ...(merged[date] || { date, views: 0 }), feedback: count };
  });

  const result = Object.values(merged).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  json(result);
}
