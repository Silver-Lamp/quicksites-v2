'use client';

import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { CelebrationModal } from '@/components/embed/CelebrationModal';

export default function SupportCampaign() {
  const { query } = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  useEffect(() => {
    if (!query.slug) return;
    fetch('/api/campaign?slug=' + query.slug)
      .then(res => res.json())
      .then(setCampaign);
  }, [query.slug]);

  useEffect(() => {
    if (query.badge === 'done') {
      setShowBadgeCelebration(true);
    }
  }, [query.badge]);

  if (!campaign) return <div className="p-6 text-white">Loading...</div>;

  const pct = Math.min(100, Math.round((campaign.count / campaign.goal_count) * 100));

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-6">
      <h1 className="text-2xl font-bold">{campaign.headline}</h1>
      <p className="text-zinc-400 text-sm">Goal: {campaign.goal_count} {campaign.target_action}s</p>
      <div className="bg-zinc-700 h-4 rounded overflow-hidden">
        <div className="bg-green-500 h-full" style={{ width: pct + '%' }}></div>
      </div>
      <p className="text-sm text-green-300">{campaign.count} {campaign.target_action}s received</p>

      {showBadgeCelebration && (
        <CelebrationModal
          type="badge"
          slug={query.slug as string}
          onClose={() => setShowBadgeCelebration(false)}
        />
      )}
    </div>
  );
}
