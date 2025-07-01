'use client';

import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { AvatarWithTooltip, TooltipProvider } from '@/components/ui';

export default function HabitLeaderboard({ slug }: { slug: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading } = useSWR(`/api/habit-leaderboard?slug=${slug}`, (url) =>
    fetch(url).then((res) => res.json())
  );

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (userId) setSelected(userId);
  }, []);

  if (isLoading || !data || !Array.isArray(data)) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center overflow-x-auto gap-2 py-2 px-4">
        {data.map((entry: any, i: number) => (
          <AvatarWithTooltip
            key={entry.user_id}
            avatarUrl={entry.avatar_url}
            username={entry.username}
            userId={entry.user_id}
            points={entry.total}
            highlight={selected === entry.user_id}
            rank={i}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
