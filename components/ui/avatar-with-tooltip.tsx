'use client';

import Image from 'next/image';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

type Props = {
  avatarUrl?: string;
  username?: string;
  userId: string;
  points: number;
  highlight?: boolean;
  rank?: number;
};

export function AvatarWithTooltip({ avatarUrl, username, userId, points, highlight, rank }: Props) {
  const borderClass = highlight ? 'ring-2 ring-green-500' : '';
  const medal = rank === 0 ? '🥇 ' : rank === 1 ? '🥈 ' : rank === 2 ? '🥉 ' : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`w-8 h-8 rounded-full border border-white dark:border-zinc-800 relative -ml-2 overflow-hidden ${borderClass}`}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="avatar" width={32} height={32} className="rounded-full" />
          ) : (
            <div className="w-full h-full rounded-full bg-zinc-300 dark:bg-zinc-600" />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {medal}
        {username || userId} — {points} points
      </TooltipContent>
    </Tooltip>
  );
}
