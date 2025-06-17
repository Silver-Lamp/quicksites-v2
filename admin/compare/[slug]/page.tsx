'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'react-hot-toast';
import { supabase } from '@/admin/lib/supabaseClient';

// 🧠 Dynamic import fixes ESM/CommonJS mismatch
const CampaignComparison = dynamic(
  () =>
    import('../../../components/admin/admin/CampaignComparison.jsx').then(
      (mod) => mod.CampaignComparison
    ),
  { ssr: false }
);

export default function CompareSlugPage() {
  const { slug } = useParams();
  const [pinned, setPinned] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      setUserId(uid || null);
      if (uid) {
        supabase
          .from('user_pinned_slugs')
          .select('slug')
          .eq('user_id', uid)
          .eq('slug', slug)
          .then(({ data }) => {
            setPinned(data?.length && data.length > 0 ? true : false);
          });
      }
    });
  }, [slug]);

  const togglePin = async () => {
    if (!userId) return;
    if (pinned) {
      await supabase
        .from('user_pinned_slugs')
        .delete()
        .eq('user_id', userId)
        .eq('slug', slug);
      toast('Unpinned from sidebar', { duration: 2000 });
    } else {
      await supabase
        .from('user_pinned_slugs')
        .insert([
          { user_id: userId, slug, pinned_at: new Date().toISOString() },
        ]);
      toast('Pinned to sidebar', { duration: 2000 });
    }
    setPinned(!pinned);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          Campaign Comparison: {slug}
          {pinned && (
            <span className="text-yellow-400 text-sm animate-pulse">📌</span>
          )}
        </h1>
        <button
          onClick={togglePin}
          className="text-sm text-blue-600 underline hover:text-blue-800"
        >
          {pinned ? 'Unpin from sidebar' : '⭐ Pin to sidebar'}
        </button>
      </div>

      <CampaignComparison slug={typeof slug === 'string' ? slug : ''} />
    </div>
  );
}
