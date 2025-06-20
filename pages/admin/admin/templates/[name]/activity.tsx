import { createClient } from '@supabase/supabase-js';
import { GetServerSideProps } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function TemplateActivity({ logs, name }: { logs: any[]; name: string }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Activity for: {name}</h1>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="border p-3 rounded bg-white shadow-sm">
            <p className="text-sm">
              <strong>{log.action}</strong> by {log.actor || 'unknown'}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(log.timestamp).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const name = context.params?.name as string;
  const { data, error } = await supabase
    .from('template_logs')
    .select('*')
    .eq('template_name', name)
    .order('timestamp', { ascending: false });

  return {
    props: {
      name,
      logs: data || [],
    },
  };
};
