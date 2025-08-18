/* components/admin/pages/CampaignsClientPage.tsx */
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar, Popover, PopoverContent, PopoverTrigger, Button } from '@/components/ui';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignFunnelTable } from '@/admin/guest-tokens/CampaignFunnelTable';
import { getJSON } from '@/components/admin/tools/http'; // uses credentials:'include'

interface Props {
  defaultRange?: DateRange;
  events?: any[] | null;
  logs?: any[] | null;
}

export function CampaignsClientPage({
  defaultRange,
  events: initialEvents,
  logs: initialLogs,
}: Props) {
  const [range, setRange] = useState<DateRange | undefined>(
    defaultRange || { from: subDays(new Date(), 7), to: new Date() }
  );

  // Ensure stable fetcher that sends cookies + no-store
  const fetcher = useMemo(
    () => (url: string) => getJSON(url, { cache: 'no-store' }),
    []
  );

  const getKey = (pageIndex: number, prev: any) => {
    if (prev && prev.nextPage === null) return null;
    const params = new URLSearchParams({
      page: String(pageIndex),
      limit: '200',
    });
    if (range?.from) params.set('rangeFrom', range.from.toISOString());
    if (range?.to) params.set('rangeTo', range.to.toISOString());
    return `/api/admin/campaign-data?${params.toString()}`;
  };

  const { data, size, setSize, isValidating, error, mutate } = useSWRInfinite(getKey, fetcher);

  // Reset to first page when the date range changes
  useEffect(() => {
    setSize(1);
    mutate(); // revalidate first page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range?.from?.toISOString(), range?.to?.toISOString()]);

  const fetchedEvents = data?.flatMap((d) => d.events || []) ?? [];
  const fetchedLogs = data?.flatMap((d) => d.logs || []) ?? [];
  const events = initialEvents || fetchedEvents;
  const logs = initialLogs || fetchedLogs;

  const hasMore = (data?.[data.length - 1]?.nextPage ?? null) !== null;

  // IntersectionObserver sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;

    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasMore && !isValidating) {
        setSize((s) => s + 1);
      }
    }, { rootMargin: '600px 0px' });

    io.observe(el);
    return () => io.unobserve(el);
  }, [hasMore, isValidating, setSize]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Campaign Analytics</h1>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[280px] justify-start text-left font-normal',
                !range?.from && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {range?.from ? (
                range.to ? (
                  <>
                    {range.from.toLocaleDateString()} - {range.to.toLocaleDateString()}
                  </>
                ) : (
                  range.from.toLocaleDateString()
                )
              ) : (
                <span>Select date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <p className="text-sm text-red-500">
          Failed to load data: {error.message || 'Unknown error'}
        </p>
      )}

      <CampaignFunnelTable events={events} logs={logs} dateRange={range || {}} />

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} aria-hidden="true" />

      {/* Subtle loading hint */}
      {isValidating && (
        <p className="text-xs text-muted-foreground">Loading more…</p>
      )}
    </div>
  );
}
