import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getServerSideProps() {
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, last_seen_at, last_seen_ip, last_seen_agent, avatar_url')
    .order('last_seen_at', { ascending: false });

  return { props: { profiles: data || [] } };
}

export default function PeoplePage({ profiles }: { profiles: any[] }) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">People Directory</h1>
      <table className="min-w-full text-sm border">
        <thead>
          <tr className="border-b bg-gray-100 text-left">
            <th className="p-2">User ID</th>
            <th className="p-2">Last Seen</th>
            <th className="p-2">IP</th>
            <th className="p-2">Agent</th>
            <th className="p-2">Avatar</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.user_id} className="border-b">
              <td className="p-2 text-xs text-gray-600">{p.user_id}</td>
              <td className="p-2">{new Date(p.last_seen_at).toLocaleString()}</td>
              <td className="p-2 text-xs">{p.last_seen_ip ?? '-'}</td>
              <td className="p-2 text-xs truncate">{p.last_seen_agent?.slice(0, 40) ?? '-'}</td>
              <td className="p-2">
                {p.avatar_url ? <img src={p.avatar_url} className="w-8 h-8 rounded-full" /> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
