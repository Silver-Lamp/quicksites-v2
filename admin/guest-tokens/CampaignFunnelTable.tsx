/* /admin/guest-tokens/CampaignFunnelTable.tsx */

'use client';

import { useMemo, useState } from 'react';
import { parseISO, isAfter, isBefore } from 'date-fns';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface UpgradeEvent {
  id: string;
  user_id: string | null;
  email: string | null;
  context: string | null;
  event_type: string;
  trigger_reason: string | null;
  utm_campaign: string | null;
  utm_source?: string | null;
  created_at: string;
}

interface UserLog {
  user_id: string;
  event_type: string;
  created_at: string;
}

interface Props {
  events: UpgradeEvent[];
  logs: UserLog[];
  dateRange: { from?: Date; to?: Date };
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#14b8a6'];

export function CampaignFunnelTable({ events, logs, dateRange }: Props) {
  const [showAllTime, setShowAllTime] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [minViews, setMinViews] = useState(10);

  const getKey = (e: UpgradeEvent) => e.user_id || e.email || `anon-${e.id}`;
  const isInRange = (date: Date) =>
    showAllTime ||
    ((!dateRange.from || isAfter(date, dateRange.from)) &&
      (!dateRange.to || isBefore(date, dateRange.to)));

  const campaignStats = useMemo(() => {
    const campaignMap = new Map<string, Record<string, Set<string>>>();

    for (const e of events) {
      const key = getKey(e);
      const date = parseISO(e.created_at);
      if (!isInRange(date)) continue;
      const campaign = e.utm_campaign || '(none)';
      const bucket = campaignMap.get(campaign) ?? {
        view: new Set(),
        click: new Set(),
        signup: new Set(),
        publish: new Set(),
        users: new Set(),
        sources: new Set(),
        userList: new Map(),
      };
      if (e.event_type === 'view') bucket.view.add(key);
      if (e.event_type === 'click') bucket.click.add(key);
      if (e.utm_source) bucket.sources.add(e.utm_source);
      bucket.users.add(key);
      (bucket.userList as Map<string, string>).set(key, e.email || e.user_id || key);
      campaignMap.set(campaign, bucket as Record<string, Set<string>>);
    }

    for (const log of logs) {
      const date = parseISO(log.created_at);
      if (!isInRange(date)) continue;
      for (const [campaign, bucket] of campaignMap.entries()) {
        if (log.user_id && bucket.users.has(log.user_id)) {
          if (log.event_type === 'signup_complete') bucket.signup.add(log.user_id);
          if (log.event_type === 'site_published') bucket.publish.add(log.user_id);
        }
      }
    }

    return Array.from(campaignMap.entries())
      .map(([campaign, bucket]) => {
        const views = bucket.view.size;
        const clicks = bucket.click.size;
        const signups = bucket.signup.size;
        const publishes = bucket.publish.size;
        const conversion = views > 0 ? ((signups / views) * 100).toFixed(1) + '%' : '—';
        return {
          campaign,
          views,
          clicks,
          signups,
          publishes,
          conversion,
          sources: Array.from(bucket.sources),
          users: Array.from(bucket.users),
          userList: Array.from((bucket.userList as unknown as Map<string, string>).entries()),
        };
      })
      .filter((row) => row.views >= minViews)
      .sort((a, b) => b.views - a.views);
  }, [events, logs, dateRange, showAllTime, minViews]);

  const sourcePieData = useMemo(() => {
    const count: Record<string, Set<string>> = {};
    for (const e of events) {
      const key = getKey(e);
      if (!isInRange(parseISO(e.created_at))) continue;
      const source = e.utm_source || '(none)';
      count[source] ??= new Set();
      count[source].add(key);
    }
    return Object.entries(count).map(([source, users]) => ({
      name: source,
      value: users.size,
    }));
  }, [events, dateRange, showAllTime]);

  const exportCampaignCSV = () => {
    const headers = ['Campaign', 'Views', 'Clicks', 'Signups', 'Publishes', 'Conversion'];
    const rows = campaignStats.map((r) =>
      [r.campaign, r.views, r.clicks, r.signups, r.publishes, r.conversion].join(',')
    );
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campaign_funnel_stats.csv';
    a.click();
  };

  const exportUserList = (campaign: string, users: [string, string][]) => {
    const headers = ['ID', 'Label'];
    const rows = users.map(([id, label]) => `${id},${label}`);
    const blob = new Blob([headers.join(',') + '\n' + rows.join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.replace(/\s+/g, '_')}_users.csv`;
    a.click();
  };

  return (
    <Card className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Campaign Cohorts</h2>
        <div className="flex gap-2">
          <input
            type="number"
            value={minViews}
            min={0}
            onChange={(e) => setMinViews(Number(e.target.value))}
            className="w-20 text-sm border rounded px-2 py-1"
            placeholder="Min views"
          />
          <Button variant="outline" size="sm" onClick={exportCampaignCSV}>
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAllTime(!showAllTime)}>
            {showAllTime ? 'Show Date Range' : 'Show All Time'}
          </Button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={sourcePieData} dataKey="value" nameKey="name" outerRadius={100} label>
            {sourcePieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-left">
            <tr>
              <th className="py-1">Campaign</th>
              <th className="py-1">👁️ Views</th>
              <th className="py-1">🚀 Clicks</th>
              <th className="py-1">✅ Signups</th>
              <th className="py-1">📤 Publishes</th>
              <th className="py-1">💡 Conversion</th>
            </tr>
          </thead>
          <tbody>
            {campaignStats.map((row) => (
              <>
                <tr
                  key={row.campaign}
                  className="border-t cursor-pointer hover:bg-muted"
                  onClick={() =>
                    setExpandedCampaign(row.campaign === expandedCampaign ? null : row.campaign)
                  }
                >
                  <td className="py-1 font-medium">{row.campaign}</td>
                  <td className="py-1">{row.views}</td>
                  <td className="py-1">{row.clicks}</td>
                  <td className="py-1">{row.signups}</td>
                  <td className="py-1">{row.publishes}</td>
                  <td className="py-1">{row.conversion}</td>
                </tr>
                {expandedCampaign === row.campaign && (
                  <tr className="text-xs text-muted-foreground">
                    <td colSpan={6} className="pl-4 py-2 bg-muted">
                      <div className="space-y-2">
                        <div>
                          <strong>Users:</strong> {row.users.length}
                        </div>
                        <div>
                          <strong>Sources:</strong> {row.sources.join(', ') || '—'}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportUserList(row.campaign, row.userList)}
                        >
                          Download Users CSV
                        </Button>
                        <ul className="text-xs list-disc pl-4 max-h-32 overflow-y-auto">
                          {row.userList.map(([id, label]) => (
                            <li key={id}>{label}</li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
