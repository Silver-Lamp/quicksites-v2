import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type ActivityMap = Record<string, number>;

type Props = {
  stats: ActivityMap;
};

type UserProfileRow = {
  user_id: string;
  last_seen_at: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, last_seen_at')
    .not('last_seen_at', 'is', null);

  const activityMap: ActivityMap = {};

  (data as UserProfileRow[] | null)?.forEach((entry) => {
    const day = new Date(entry.last_seen_at).toISOString().split('T')[0];
    activityMap[day] = (activityMap[day] || 0) + 1;
  });

  return { props: { stats: activityMap } };
};

export default function PeopleStats({ stats }: Props) {
  const days = Object.keys(stats).sort();
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold mb-4">
        Activity Heatmap (Last Seen by Day)
      </h1>
      <div className="grid grid-cols-5 gap-2">
        {days.map((day) => (
          <div
            key={day}
            className="flex items-center justify-between border p-2 rounded bg-gray-50"
          >
            <span className="text-xs text-gray-600">{day}</span>
            <span className="font-semibold text-blue-600">{stats[day]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
