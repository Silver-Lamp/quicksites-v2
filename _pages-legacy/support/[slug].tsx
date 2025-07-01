'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { json } from '@/lib/api/json';
import { useEffect, useState } from 'react';
import { CelebrationModal } from '@/components/embed/celebration-modal';

export default function SupportCampaign() {
  const searchParams = useSearchParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  useEffect(() => {
    if (!searchParams?.get('slug')) return;
    fetch('/api/campaign?slug=' + searchParams.get('slug'))
      .then((res) => res.json())
      .then(setCampaign);
  }, [searchParams?.get('slug')]);

  useEffect(() => {
    if (searchParams?.get('badge') === 'done') {
      setShowBadgeCelebration(true);
    }
  }, [searchParams?.get('badge')]);

  if (!campaign) return <div className="p-6 text-white">Loading...</div>;

  const pct = Math.min(100, Math.round((campaign.count / campaign.goal_count) * 100));

  return (
    <div className="max-w-xl mx-auto p-6 text-white space-y-6">
      <h1 className="text-2xl font-bold">{campaign.headline}</h1>
      <p className="text-zinc-400 text-sm">
        Goal: {campaign.goal_count} {campaign.target_action}s
      </p>
      <div className="bg-zinc-700 h-4 rounded overflow-hidden">
        <div className="bg-green-500 h-full" style={{ width: pct + '%' }}></div>
      </div>
      <p className="text-sm text-green-300">
        {campaign.count} {campaign.target_action}s received
      </p>

      {showBadgeCelebration && (
        <CelebrationModal
          type="badge"
          slug={searchParams?.get('slug') as string}
          onClose={() => setShowBadgeCelebration(false)}
        />
      )}
    </div>
  );
}
