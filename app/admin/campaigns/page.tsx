// app/admin/campaigns/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import CampaignPanel from '@/components/admin/campaigns/campaign-panel';
import { CampaignType } from '@/types/campaign.types';
import { Lead } from '@/types/lead.types';
import dayjs from 'dayjs';
import EditCampaignModal from '@/components/admin/campaigns/edit-campaign-modal';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignType[]>([]);
  const [leadsByCampaign, setLeadsByCampaign] = useState<Record<string, Lead[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [now] = useState(dayjs());
  const [editingCampaign, setEditingCampaign] = useState<CampaignType | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: campaignData, error: cErr } = await supabase
        .from('campaigns')
        .select('*')
        .order('starts_at', { ascending: false });
      if (cErr) throw cErr;

      // Only leads attached to a campaign — no need to pull the entire table.
      const { data: leadData, error: lErr } = await supabase
        .from('leads')
        .select('*')
        .not('current_campaign_id', 'is', null);
      if (lErr) throw lErr;

      const grouped: Record<string, Lead[]> = {};
      for (const lead of leadData || []) {
        const cid = (lead as any).current_campaign_id;
        if (!cid) continue;
        (grouped[cid] ||= []).push(lead as Lead);
      }

      setCampaigns((campaignData || []) as CampaignType[]);
      setLeadsByCampaign(grouped);
    } catch (e: any) {
      setError(e?.message || 'Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Opening the editor just sets the campaign; closing it (null) refetches so
  // edits reflect without a full page reload.
  const handleSetEditing = useCallback(
    (c: CampaignType | null) => {
      setEditingCampaign(c);
      if (!c) fetchData();
    },
    [fetchData],
  );

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Campaigns</h1>
          {!loading && !error && (
            <p className="mt-0.5 text-sm text-neutral-400">
              {campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}
            </p>
          )}
        </div>
        <Link
          href="/admin/start-campaign"
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          <span className="text-base leading-none">+</span> Start new campaign
        </Link>
      </div>

      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          allLeads={Object.values(leadsByCampaign).flat()}
          selectedLeadIds={selectedLeadIds}
          setSelectedLeadIds={setSelectedLeadIds}
          leadsByCampaign={leadsByCampaign}
          setEditingCampaign={handleSetEditing}
        />
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg border border-white/10 bg-white/[0.03]" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {error}{' '}
          <button onClick={fetchData} className="ml-2 underline underline-offset-2 hover:text-red-200">
            Retry
          </button>
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-10 text-center text-sm text-neutral-400">
          No campaigns yet.
        </div>
      ) : (
        campaigns.map((c) => (
          <CampaignPanel
            key={c.id}
            campaign={c}
            leads={leadsByCampaign[c.id] || []}
            now={now}
            expanded={expanded[c.id] ?? true}
            setExpanded={(v) => setExpanded((prev) => ({ ...prev, [c.id]: v }))}
            setEditingCampaign={handleSetEditing}
            setSelectedLeadIds={setSelectedLeadIds}
          />
        ))
      )}
    </div>
  );
}
