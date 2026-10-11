'use client';

// The one button on /spread-the-word: "Sign in to start" for a visitor, and for a member a
// line saying their links already carry their code (the tables below do the rest).
import * as React from 'react';
import { CurrentUserContext } from '@/components/admin/context/current-user-provider';

export default function SpreadStartButton({ signUpHref }: { signUpHref: string }) {
  const { user, ready } = React.useContext(CurrentUserContext);
  const member = ready && !!user && !(user as { is_anonymous?: boolean | null }).is_anonymous;
  if (member) {
    return <p className="text-sm text-emerald-300">You’re signed in — every link the boxes below hand you carries your code.</p>;
  }
  return (
    <a href={signUpHref} className="inline-block rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400">
      Sign in to start — it’s free
    </a>
  );
}
