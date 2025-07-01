'use client';
import { useEffect, useState } from 'react';
import { json } from '@/lib/api/json';
import { useUser } from '@supabase/auth-helpers-react';

export default function NotificationsPage() {
  const user = useUser();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/notifications?handle=' + user.user_metadata?.handle)
      .then((res) => res.json())
      .then(setItems);
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto p-6 text-white space-y-4">
      <h1 className="text-2xl font-bold">🔔 Notifications</h1>
      {items.length === 0 && <p className="text-zinc-400">Nothing new yet.</p>}
      {items.map((r: any) => (
        <div key={r.id} className="bg-zinc-800 p-4 rounded">
          <div className="text-sm">
            <span className="text-green-400">@{r.receiver_handle}</span> received a support request
          </div>
          <div className="text-zinc-400 text-xs mt-1">
            {r.slug} • {r.message}
          </div>
        </div>
      ))}
    </div>
  );
}
