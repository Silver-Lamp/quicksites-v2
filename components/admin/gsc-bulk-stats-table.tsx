// components/admin/gsc-bulk-stats-table.tsx
'use client';

import { Fragment, useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader } from 'lucide-react';

type Row = {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
};

type DomainResult = {
  [domain: string]: Row[] | { error: string };
};

const datePresets = [
  { label: 'Last 7 days', start: daysAgo(7), end: today() },
  { label: 'Last 30 days', start: daysAgo(30), end: today() },
  { label: 'Last 90 days', start: daysAgo(90), end: today() },
];

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function GSCBulkStatsTable() {
  const [data, setData] = useState<DomainResult>({});
  const [loading, setLoading] = useState(true);
  const [rangeIndex, setRangeIndex] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const selectedRange = datePresets[rangeIndex];

  useEffect(() => {
    const { start, end } = selectedRange;
    setLoading(true);
    fetch(`/api/gsc/performance/all?startDate=${start}&endDate=${end}`)
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedRange]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4 text-sm text-white/80">
        <span>Showing:</span>
        <select
          value={rangeIndex}
          onChange={(e) => setRangeIndex(Number(e.target.value))}
          className="bg-black border border-white/20 rounded px-2 py-1"
        >
          {datePresets.map((r, i) => (
            <option key={r.label} value={i}>
              {r.label}
            </option>
          ))}
        </select>
        <span className="opacity-50">
          ({selectedRange.start} to {selectedRange.end})
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center text-white opacity-70 py-12">
          <Loader className="animate-spin mr-2" /> Loading Search Console data...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table
            className="
              w-full table-fixed
              [&_tr]:border-b [&_tr]:border-white/10 [&_tr:last-child]:border-0
            "
          >
            {/* Lock column widths so header/body never drift */}
            <colgroup>
              <col className="w-[34%]" />  {/* Domain */}
              <col className="w-[38%]" />  {/* Page or Query */}
              <col className="w-[9%]" />   {/* Clicks */}
              <col className="w-[11%]" />  {/* Impressions */}
              <col className="w-[4%]" />   {/* CTR */}
              <col className="w-[4%]" />   {/* Avg Position */}
            </colgroup>

            <TableHeader className="sticky top-0 z-10 bg-neutral-950/95 backdrop-blur [&_tr]:border-white/10">
              <TableRow className="text-left text-xs uppercase text-white/60 [&_th]:px-3 sm:[&_th]:px-4">
                <TableHead className="text-left">Domain</TableHead>
                <TableHead className="text-left">Page or Query</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Impressions</TableHead>
                <TableHead className="text-right">CTR</TableHead>
                <TableHead className="text-right">Avg Position</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="[&_td]:px-3 sm:[&_td]:px-4 [&_tr:hover]:bg-white/5">
              {Object.entries(data).map(([domain, rows]) => {
                const isError = 'error' in (rows as any);
                const isOpen = expanded[domain] ?? false;
                const typedRows = isError ? [] : (rows as Row[]);

                const clicks = Math.max(...typedRows.map((r) => r.clicks ?? 0), 0);
                const impressions = typedRows.reduce(
                  (sum, r) => sum + (r.impressions ?? 0),
                  0
                );
                const bestCTR = Math.max(...typedRows.map((r) => r.ctr ?? 0), 0);
                const bestPosition = Math.min(
                  ...typedRows.map((r) => r.position ?? Infinity)
                );

                const groupedByPage = typedRows.reduce((acc, row) => {
                  if (!acc[row.page]) acc[row.page] = [];
                  acc[row.page].push(row);
                  return acc;
                }, {} as Record<string, Row[]>);

                return (
                  <Fragment key={domain}>
                    {/* Domain summary */}
                    <TableRow
                      className="cursor-pointer"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [domain]: !isOpen }))
                      }
                    >
                      <TableCell className="text-white font-semibold">
                        <span className="mr-2">{isOpen ? '▼' : '▶'}</span>
                        {domain}
                      </TableCell>
                      <TableCell className="text-xs text-white/70 italic">
                        {isOpen ? '' : 'Best-performing query'}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-green-400">
                        {clicks}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-blue-300">
                        {impressions}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-yellow-300">
                        {bestCTR.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-purple-300">
                        {bestPosition === Infinity ? '—' : bestPosition.toFixed(1)}
                      </TableCell>
                    </TableRow>

                    {/* Error message */}
                    {isError && (
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={5} className="text-xs text-red-300">
                          {(rows as any).error || 'Failed to load data for this domain.'}
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Page + query rows */}
                    {isOpen &&
                      !isError &&
                      Object.entries(groupedByPage).map(([page, queries]) => (
                        <Fragment key={`${domain}-${page}`}>
                          <TableRow className="bg-white/[0.04] text-white/70 text-xs">
                            <TableCell />
                            <TableCell colSpan={5} className="truncate">
                              {page}
                            </TableCell>
                          </TableRow>

                          {queries.map((row, i) => (
                            <TableRow key={`${domain}-${page}-${i}`}>
                              <TableCell />
                              <TableCell className="text-white text-xs truncate">
                                "{row.query}"
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-green-400">
                                {row.clicks}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-blue-300">
                                {row.impressions}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-yellow-300">
                                {(row.ctr ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-purple-300">
                                {(row.position ?? 0).toFixed(1)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      ))}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
