import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SharedAnalytics({
  domain,
  views,
}: {
  domain: string;
  views: any[];
}) {
  const byDay: Record<string, number> = {};
  views.forEach((v) => {
    const day = new Date(v.viewed_at).toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics for {domain}</h1>

      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={async () => {
            const QRCode = await import('qrcode');
            const url = window.location.href;
            QRCode.toDataURL(url).then((dataUrl: string) => {
              const win = window.open();
              if (win)
                win.document.write(`<img src='${dataUrl}' /><p>${url}</p>`);
            });
          }}
          className="text-sm text-blue-600 underline"
        >
          📸 Generate QR Code
        </button>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const email = (
              (e.target as HTMLFormElement).querySelector(
                'input[type=email]'
              ) as HTMLInputElement
            )?.value;
            if (email) {
              await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain, email }),
              });
              alert('Subscribed to updates for ' + domain);
            }
          }}
          className="flex gap-2 items-center"
        >
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="border rounded px-2 py-1 text-sm"
          />
          <button type="submit" className="text-sm text-green-600 underline">
            📬 Subscribe to reports
          </button>
        </form>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Views per Day</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={Object.entries(byDay).map(([day, count]) => ({ day, count }))}
          >
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <p className="text-sm text-muted-foreground">
        Total views: {views.length}
      </p>
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
      views: data || [],
    },
  };
};
