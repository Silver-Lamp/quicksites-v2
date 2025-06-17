/* components/admin/pages/CampaignsClientPage.tsx */

'use client';

import { useEffect, useState } from 'react';
import useSWRInfinite from 'swr/infinite';
import { subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/admin/ui/button';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CampaignFunnelTable } from '@/admin/guest-tokens/CampaignFunnelTable';

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
    defaultRange || {
      from: subDays(new Date(), 7),
      to: new Date(),
    }
  );

  const getKey = (pageIndex: number, prev: any) => {
    if (prev && prev.nextPage === null) return null;
    const params = new URLSearchParams({
      page: pageIndex.toString(),
      limit: '200',
    });
    if (range?.from) params.set('rangeFrom', range.from.toISOString());
    if (range?.to) params.set('rangeTo', range.to.toISOString());
    return `/api/admin/campaign-data?${params.toString()}`;
  };

  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  const { data, size, setSize, isValidating } = useSWRInfinite(getKey, fetcher);

  const fetchedEvents = data?.flatMap((d) => d.events || []) || [];
  const fetchedLogs = data?.flatMap((d) => d.logs || []) || [];

  const events = initialEvents || fetchedEvents;
  const logs = initialLogs || fetchedLogs;

  const hasMore = data?.[data.length - 1]?.nextPage !== null;

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const bottom = document.body.offsetHeight - window.innerHeight;
      if (scrollY > bottom - 300 && hasMore && !isValidating) {
        setSize(size + 1);
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, [size, setSize, hasMore, isValidating]);

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
                    {range.from.toLocaleDateString()} -{' '}
                    {range.to.toLocaleDateString()}
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
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      <CampaignFunnelTable
        events={events}
        logs={logs}
        dateRange={range || {}}
      />
    </div>
  );
}
