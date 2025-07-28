// app/admin/guest-tokens/page.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { isAfter, isBefore, parseISO, subDays } from 'date-fns';
import { Button } from '@/components/ui';
import { CalendarIcon, DownloadIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui';

interface UpgradeEvent {
  id: string;
  user_id: string | null;
  email: string | null;
  context: string | null;
  event_type: string;
  trigger_reason: string | null;
  created_at: string;
}

export default function GuestUpgradeDashboard() {
  const [events, setEvents] = useState<UpgradeEvent[]>([]);
  const [userLogs, setUserLogs] = useState<any[]>([]);
  const [contextFilter, setContextFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [openStep, setOpenStep] = useState<string | null>(null);

  const toggleStep = (key: string) => setOpenStep((prev) => (prev === key ? null : key));

  useEffect(() => {
    const loadEvents = async () => {
      const { data, error } = await supabase
        .from('guest_upgrade_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (!error) setEvents(data);
    };
    const loadUserLogs = async () => {
      const { data, error } = await supabase
        .from('user_action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (!error) setUserLogs(data);
    };
    loadEvents();
    loadUserLogs();
  }, []);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const date = parseISO(e.created_at);
      const inRange =
        (!dateRange?.from || isAfter(date, dateRange.from)) &&
        (!dateRange?.to || isBefore(date, dateRange.to));
      const inContext = !contextFilter || e.context === contextFilter;
      return inRange && inContext;
    });
  }, [events, contextFilter, dateRange]);

  const getKey = (e: { user_id: string | null; email?: string | null; id: string }) =>
    e.user_id || e.email || `anon-${e.id}`;
  const getLabel = (e: { user_id: string | null; email?: string | null }) =>
    e.email || e.user_id || 'anonymous';

  const funnelCounts = useMemo(() => {
    const views = new Set<string>();
    const clicks = new Set<string>();
    const signups = new Set<string>();
    const publishes = new Set<string>();

    for (const e of filtered) {
      const key = getKey(e);
      if (e.event_type === 'view') views.add(key);
      if (e.event_type === 'click') clicks.add(key);
    }

    for (const log of userLogs) {
      const logDate = parseISO(log.created_at);
      const inRange =
        (!dateRange?.from || isAfter(logDate, dateRange.from)) &&
        (!dateRange?.to || isBefore(logDate, dateRange.to));
      if (!log.user_id || !inRange) continue;
      if (log.event_type === 'signup_complete') signups.add(log.user_id);
      if (log.event_type === 'site_published') publishes.add(log.user_id);
    }

    return {
      views: views.size,
      clicks: clicks.size,
      signups: signups.size,
      publishes: publishes.size,
    };
  }, [filtered, userLogs, dateRange]);

  const funnelDetails = useMemo(() => {
    const views = new Map<string, string>();
    const clicks = new Map<string, string>();
    const signups = new Map<string, string>();
    const publishes = new Map<string, string>();

    for (const e of filtered) {
      const key = getKey(e);
      const label = getLabel(e);
      if (e.event_type === 'view') views.set(key, label);
      if (e.event_type === 'click') clicks.set(key, label);
    }

    for (const log of userLogs) {
      const logDate = parseISO(log.created_at);
      const inRange =
        (!dateRange?.from || isAfter(logDate, dateRange.from)) &&
        (!dateRange?.to || isBefore(logDate, dateRange.to));
      if (!log.user_id || !inRange) continue;
      if (log.event_type === 'signup_complete') signups.set(log.user_id, log.user_id);
      if (log.event_type === 'site_published') publishes.set(log.user_id, log.user_id);
    }

    return {
      views: [...views.entries()],
      clicks: [...clicks.entries()],
      signups: [...signups.entries()],
      publishes: [...publishes.entries()],
    };
  }, [filtered, userLogs, dateRange]);

  const exportFunnelCSV = () => {
    const rows = [
      ['Step', 'Count'],
      ['Modal Viewed', funnelCounts.views],
      ['Clicked Upgrade', funnelCounts.clicks],
      ['Signup Complete', funnelCounts.signups],
      ['Site Published', funnelCounts.publishes],
    ];
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'funnel_counts.csv';
    link.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Guest Upgrade Funnel</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[280px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                  </>
                ) : (
                  dateRange.from.toLocaleDateString()
                )
              ) : (
                <span>Select date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            🧭 Funnel Drop-Off (unique users)
          </h2>
          <Button size="sm" variant="outline" onClick={exportFunnelCSV}>
            <DownloadIcon className="w-4 h-4 mr-2" /> Export Funnel
          </Button>
        </div>

        {(
          [
            {
              key: 'views',
              label: '👁️ Modal Viewed',
              count: funnelCounts.views,
            },
            {
              key: 'clicks',
              label: '🚀 Clicked Upgrade',
              count: funnelCounts.clicks,
            },
            {
              key: 'signups',
              label: '✅ Signup Complete',
              count: funnelCounts.signups,
            },
            {
              key: 'publishes',
              label: '📤 Site Published',
              count: funnelCounts.publishes,
            },
          ] as const
        ).map((step) => (
          <div
            key={step.key}
            className="w-full bg-muted rounded-md p-2 cursor-pointer"
            onClick={() => toggleStep(step.key)}
          >
            <div className="flex items-center justify-between">
              <span>{step.label}</span>
              <span className="font-bold">{step.count}</span>
            </div>
            {openStep === step.key && (
              <div className="mt-2 pl-2 text-sm text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                {(funnelDetails as any)[step.key]?.map(([id, label]: [string, string]) => (
                  <div key={id} className="truncate">
                    • {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
