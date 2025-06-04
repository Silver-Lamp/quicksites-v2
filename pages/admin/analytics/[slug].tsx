import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SharedAnalytics({ domain, views }: { domain: string, views: any[] }) {
  const byDay: Record<string, number> = {};
  views.forEach(v => {
    const day = new Date(v.viewed_at).toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics for {domain}</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">Views per Day</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={Object.entries(byDay).map(([day, count]) => ({ day, count }))}>
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <p className="text-sm text-muted-foreground">Total views: {views.length}</p>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const slug = context.params?.slug as string;
  const { data } = await supabase
    .from('template_views')
    .select('*')
    .eq('domain', slug);

  return {
    props: {
      domain: slug,
      views: data || []
    }
  };
};
