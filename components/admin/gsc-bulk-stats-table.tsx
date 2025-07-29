// components/admin/gsc-bulk-stats-table.tsx
'use client';

import { useEffect, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader } from 'lucide-react';

type Row = {
  keys?: string[];
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
  const [rangeIndex, setRangeIndex] = useState(1); // Default to 30 days

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
    <div className="space-y-4">
      {/* Date Range Selector */}
      <div className="flex items-center gap-2 text-sm text-white/80">
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
        <span className="opacity-50">({selectedRange.start} to {selectedRange.end})</span>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="flex items-center justify-center text-white opacity-70 py-12">
          <Loader className="animate-spin mr-2" /> Loading Search Console data...
        </div>
      ) : Object.keys(data).length === 0 ? (
        <p className="text-sm text-white/60">No GSC data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-left text-sm uppercase text-white/60">
                <TableHead>Domain</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Avg Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(data).flatMap(([domain, rows]) => {
                if ('error' in (rows as any)) {
                  return (
                    <TableRow key={domain}>
                      <TableCell colSpan={6}>
                        <span className="text-red-400 font-semibold">{domain}</span> — {(rows as any).error}
                      </TableCell>
                    </TableRow>
                  );
                }

                return (rows as Row[]).map((row, i) => (
                  <TableRow key={`${domain}-${i}`}>
                    <TableCell className="text-white">{domain}</TableCell>
                    <TableCell className="text-white text-xs">{row.keys?.[0]}</TableCell>
                    <TableCell className="text-green-400">{row.clicks}</TableCell>
                    <TableCell className="text-blue-300">{row.impressions}</TableCell>
                    <TableCell className="text-yellow-300">{(row.ctr || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-purple-300">{(row.position || 0).toFixed(1)}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
