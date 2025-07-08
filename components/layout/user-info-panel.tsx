// components/layout/user-info-panel.tsx
'use client';

import type { SafeUser } from '@/types/safe-user';

type Props = {
  user: SafeUser | null;
  role: string;
  isLoggedIn: boolean;
};

export default function UserInfoPanel({
  isLoggedIn,
  user,
  role,
}: Props) {
  if (!isLoggedIn || !user) {
    return (
      <a href="/login" className="text-blue-400 hover:underline">
        Log In
      </a>
    );
  }

  return (
    <div className="ml-2 flex items-center gap-2">
      <div className="text-xs text-gray-400 mr-2 text-right leading-tight">
        <div>{user.email}</div>
        <div className="text-zinc-500">role: {role}</div>
      </div>
    </div>
  );
}
