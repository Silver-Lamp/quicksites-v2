// components/layout/user-info-panel.tsx
'use client';

import { SignInLink } from '@/components/auth/auth-links';
import type { SafeUser } from '@/types/safe-user';

type Props = {
  user: SafeUser | null;
  role: string;
  isLoggedIn: boolean;
};

export default function UserInfoPanel({ isLoggedIn, user, role }: Props) {
  if (!isLoggedIn || !user) {
    return <SignInLink variant="inline" />;
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
