'use client';

// The one interactive element on /admin/referrals. It lives in its own client component
// because the page is a server component, and an `onClick` there is not a warning — it is
// the "Application error" the page showed for four days once the table had rows.

import { useState } from 'react';

export default function CopyLinkButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="ml-3 rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable — the link is still a plain anchor beside this */
        }
      }}
    >
      {done ? 'copied' : 'copy'}
    </button>
  );
}
