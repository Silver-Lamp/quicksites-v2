/* components/admin/CampaignComparison.tsx */

'use client';

import { useMemo, useState } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/admin/ui/select';
import { Card } from '@/components/admin/ui/card';
import { parseISO, isAfter, isBefore } from 'date-fns';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Input } from '@/components/admin/ui/input';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/admin/ui/button';

interface UpgradeEvent {
  id: string;
  slug: string;
  user_id: string | null;
  email: string | null;
  context: string | null;
  event_type: string;
  trigger_reason: string | null;
  utm_campaign: string | null;
  created_at: string;
}

interface UserLog {
  user_id: string;
  event_type: string;
  created_at: string;
}

interface Props {
  events?: UpgradeEvent[];
  logs?: UserLog[];
  dateRange?: { from?: Date; to?: Date };
  slug?: string;
}

export function CampaignComparison({ events, logs, dateRange }: Props) {
  const [left, setLeft] = useState<string>('');
  const [right, setRight] = useState<string>('');
  const [leftNote, setLeftNote] = useState('');
  const [rightNote, setRightNote] = useState('');
  const router = useRouter();

  const campaigns = useMemo(() => {
    const set = new Set(events?.map(e => e.utm_campaign || '(none)') || []);
    return Array.from(set).sort();
  }, [events]);

  const isInRange = (date: Date) =>
    (!dateRange?.from || isAfter(date, dateRange.from)) &&
    (!dateRange?.to || isBefore(date, dateRange.to));

  const summarize = (campaign: string) => {
    const keys = new Set<string>();
    const stats = {
      views: 0,
      clicks: 0,
      signups: 0,
      publishes: 0,
    };

    for (const e of events || []) {
      if ((e.utm_campaign || '(none)') !== campaign) continue;
      if (!isInRange(parseISO(e.created_at))) continue;
      const key = e.user_id || e.email || `anon-${e.id}`;
      keys.add(key);
      if (e.event_type === 'view') stats.views++;
      if (e.event_type === 'click') stats.clicks++;
    }

    for (const l of logs || []) {
      if (!isInRange(parseISO(l.created_at))) continue;
      if (keys.has(l.user_id)) {
        if (l.event_type === 'signup_complete') stats.signups++;
        if (l.event_type === 'site_published') stats.publishes++;
      }
    }

    return stats;
  };

  const leftStats = left ? summarize(left) : null;
  const rightStats = right ? summarize(right) : null;

  const chartData = useMemo(() => {
    if (!leftStats || !rightStats) return [];
    return [
      { metric: '👁️ Views', [left]: leftStats.views, [right]: rightStats.views },
      { metric: '🚀 Clicks', [left]: leftStats.clicks, [right]: rightStats.clicks },
      { metric: '✅ Signups', [left]: leftStats.signups, [right]: rightStats.signups },
      { metric: '📤 Publishes', [left]: leftStats.publishes, [right]: rightStats.publishes },
    ];
  }, [left, right, leftStats, rightStats]);

  const conversionRate = (views: number, signups: number) =>
    views > 0 ? ((signups / views) * 100).toFixed(1) + '%' : '—';

  const delta = useMemo(() => {
    if (!leftStats || !rightStats) return null;
    const leftCR = leftStats.views ? leftStats.signups / leftStats.views : 0;
    const rightCR = rightStats.views ? rightStats.signups / rightStats.views : 0;
    const diff = ((rightCR - leftCR) * 100).toFixed(1);
    return `${Number(diff) > 0 ? '+' : ''}${diff}%`; // e.g. +12.5%
  }, [leftStats, rightStats]);

  const handleShare = () => {
    if (!left || !right) return;
    const slug = `${encodeURIComponent(left)}-vs-${encodeURIComponent(right)}`;
    router.push(`/compare/${slug}`);
  };

  return (
    <Card className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Compare Campaigns</h2>
        <Button onClick={handleShare} variant="outline" size="sm">Share View</Button>
      </div>

      <div className="flex gap-4">
        <div className="w-1/2 space-y-2">
          <Select value={left} onValueChange={setLeft}>
            <SelectTrigger><SelectValue placeholder="Select campaign A" /></SelectTrigger>
            <SelectContent>
              {campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Annotation or label" value={leftNote} onChange={e => setLeftNote(e.target.value)} />
        </div>
        <div className="w-1/2 space-y-2">
          <Select value={right} onValueChange={setRight}>
            <SelectTrigger><SelectValue placeholder="Select campaign B" /></SelectTrigger>
            <SelectContent>
              {campaigns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Annotation or label" value={rightNote} onChange={e => setRightNote(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 text-sm gap-4 mt-4">
        <div className="text-muted-foreground">Metric</div>
        <div className="font-medium">{left || '-'}</div>
        <div className="font-medium">{right || '-'}</div>

        <div className="text-muted-foreground">👁️ Views</div>
        <div>{leftStats?.views ?? '-'}</div>
        <div>{rightStats?.views ?? '-'}</div>

        <div className="text-muted-foreground">🚀 Clicks</div>
        <div>{leftStats?.clicks ?? '-'}</div>
        <div>{rightStats?.clicks ?? '-'}</div>

        <div className="text-muted-foreground">✅ Signups</div>
        <div>{leftStats?.signups ?? '-'}</div>
        <div>{rightStats?.signups ?? '-'}</div>

        <div className="text-muted-foreground">📤 Publishes</div>
        <div>{leftStats?.publishes ?? '-'}</div>
        <div>{rightStats?.publishes ?? '-'}</div>

        <div className="text-muted-foreground">💡 Conversion Rate</div>
        <div>{leftStats ? conversionRate(leftStats.views, leftStats.signups) : '-'}</div>
        <div>{rightStats ? conversionRate(rightStats.views, rightStats.signups) : '-'}</div>
        <div className="text-muted-foreground">🔁 Delta</div>
        <div className="col-span-2">{delta || '-'}</div>
      </div>

      {chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <XAxis dataKey="metric" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey={left} fill="#6366f1" />
            <Bar dataKey={right} fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
