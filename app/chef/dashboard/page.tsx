// app/chef/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import toast from 'react-hot-toast';
import { COMMON_CUISINES } from '@/lib/cuisines';

import ComplianceMissingCard from '@/components/chef/compliance-missing-card';
import SiteSelectorCard from '@/components/admin/chef/SiteSelectorCard';
import ProfileCard from '@/components/admin/chef/ProfileCard';
import CreateMealCard from '@/components/admin/chef/CreateMealCard';
import MyMealsCard from '@/components/admin/chef/MyMealsCard';
import WaitlistCard from '@/components/admin/chef/WaitlistCard';
import PostScheduleCard from '@/components/admin/chef/PostScheduleCard';
import SocialConnectorsCard from '@/components/admin/chef/SocialConnectorsCard';
import StickerCard from '@/components/admin/chef/StickerCard';

import { useChefSiteId } from '@/hooks/useChefSiteId';

// Keep this lightweight copy of the /api/chef/me response
export type MeResp = {
  merchant: { id: string; name: string; default_platform_fee_bps: number } | null;
  stripeAccountId: string | null;
  sites: { site_id: string; status: string; role: string }[];
} | null;

export default function ChefDashboardPage() {
  const { siteId, setSiteId } = useChefSiteId();

  const [me, setMe] = useState<MeResp>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [cuisineOptions, setCuisineOptions] = useState<string[]>(COMMON_CUISINES);

  // External bump to force MyMealsCard reload after a new meal is created
  const [mealsBump, setMealsBump] = useState(0);

  useEffect(() => {
    (async () => {
      setLoadingMe(true);
      try {
        const r = await fetch('/api/chef/me');
        if (r.status === 401) {
          toast.error('Please sign in first.');
          return;
        }
        const data = await r.json();
        setMe(data);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load');
      } finally {
        setLoadingMe(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!siteId) return;
    (async () => {
      try {
        const p = new URLSearchParams({ siteId });
        const r = await fetch(`/api/public/cuisines?${p.toString()}`);
        const data = await r.json();
        const arr = Array.isArray(data?.cuisines) && data.cuisines.length ? data.cuisines : COMMON_CUISINES;
        setCuisineOptions(arr);
      } catch {
        setCuisineOptions(COMMON_CUISINES);
      }
    })();
  }, [siteId]);

  const approvedForSite = useMemo(
    () => !!(me && siteId && me.sites?.some((s) => s.site_id === siteId && s.status === 'approved')),
    [me, siteId]
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <ComplianceMissingCard />

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Chef Dashboard</h1>
        {!loadingMe && (
          <Badge variant={me?.stripeAccountId ? 'default' : 'secondary'}>
            {me?.stripeAccountId ? 'Payouts Connected' : 'Payouts Not Connected'}
          </Badge>
        )}
      </div>

      {/* Optional: X (Twitter) connect quick action */}
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Social</h2>
        <p className="text-sm text-muted-foreground mb-2">Connect your X (Twitter) to enable scheduled posts.</p>
        <a className="rounded-md border px-3 py-1 text-sm" href="/api/social/x/connect">
          Connect X
        </a>
      </div>

      <SiteSelectorCard me={me} siteId={siteId} setSiteId={setSiteId} />

      <ProfileCard />

      <CreateMealCard
        siteId={siteId}
        approvedForSite={approvedForSite}
        cuisineOptions={cuisineOptions}
        onCreated={() => setMealsBump((x) => x + 1)}
      />

      {/* Force a data refresh when mealsBump changes */}
      <MyMealsCard key={mealsBump} siteId={siteId} />

      <WaitlistCard siteId={siteId} />
      <PostScheduleCard siteId={siteId} />
      <SocialConnectorsCard siteId={siteId} />

      <StickerCard merchantId={me?.merchant?.id || ''} merchantName={me?.merchant?.name || ''} />
    </div>
  );
}
