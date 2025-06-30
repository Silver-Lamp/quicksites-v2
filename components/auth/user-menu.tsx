'use client';

import { useLoginStatus } from '@/hooks/useLoginStatus';
import LogoutButton from './logout-button';
import Image from 'next/image';

export default function UserMenu() {
  const { user, loading } = useLoginStatus();

  const traceId = typeof window !== 'undefined' ? document?.body?.dataset?.traceId ?? '' : '';
  const abVariant = typeof window !== 'undefined' ? document?.body?.dataset?.abVariant ?? '' : '';
  const role = typeof window !== 'undefined' ? document?.body?.dataset?.userRole ?? 'guest' : '';

  if (loading || !user) return null;

  return (
    <div className="text-sm text-zinc-300 flex flex-col gap-2 p-4 border border-zinc-700 rounded bg-zinc-900 shadow">
      <div className="flex items-center gap-3">
        {user.user_metadata?.avatar_url && (
          <Image
            src={user.user_metadata.avatar_url}
            alt="Avatar"
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <div className="flex flex-col">
          <span className="text-white">{user.email}</span>
          <span className="text-xs text-zinc-500">Role: {role}</span>
        </div>
      </div>

      {abVariant && (
        <div className="text-xs text-zinc-500">
          A/B Variant: <span className="text-indigo-400">{abVariant}</span>
        </div>
      )}

      {traceId && (
        <div className="text-xs text-zinc-500 break-all">
          Trace ID: <span className="text-zinc-400">{traceId.slice(0, 8)}...</span>
        </div>
      )}

      <LogoutButton />
    </div>
  );
}
