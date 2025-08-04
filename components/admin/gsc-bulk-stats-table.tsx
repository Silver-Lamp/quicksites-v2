'use client';

import { useEffect, useState } from 'react';
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
    <div className="space-y-4">
      {/* Controls */}
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
          <Table>
            <TableHeader>
              <TableRow className="text-left text-sm uppercase text-white/60">
                <TableHead>Domain</TableHead>
                <TableHead>Page or Query</TableHead>
                <TableHead>Clicks</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead>CTR</TableHead>
                <TableHead>Avg Position</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(data).map(([domain, rows]) => {
                const isError = 'error' in (rows as any);
                const isOpen = expanded[domain] ?? true;
                const typedRows = isError ? [] : (rows as Row[]);

                const groupedByPage = typedRows.reduce((acc, row) => {
                  if (!acc[row.page]) acc[row.page] = [];
                  acc[row.page].push(row);
                  return acc;
                }, {} as Record<string, Row[]>);

                return (
                  <tbody key={domain}>
                    <TableRow
                      className="cursor-pointer hover:bg-white/5"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [domain]: !isOpen }))
                      }
                    >
                      <TableCell className="text-white font-semibold">
                        <span className="mr-2">{isOpen ? '▼' : '▶'}</span>
                        {domain}
                      </TableCell>
                      <TableCell colSpan={5} className="text-white/50 italic">
                        {isOpen ? '' : 'Query breakdown by page'}
                      </TableCell>
                    </TableRow>

                    {isOpen &&
                      Object.entries(groupedByPage).map(([page, queries]) => (
                        <>
                          <TableRow className="bg-black/10 text-white/70 text-xs">
                            <TableCell />
                            <TableCell colSpan={5}>{page}</TableCell>
                          </TableRow>
                          {queries.map((row, i) => (
                            <TableRow key={`${domain}-${page}-${i}`}>
                              <TableCell />
                              <TableCell className="text-white text-xs">
                                "{row.query}"
                              </TableCell>
                              <TableCell className="text-green-400">{row.clicks}</TableCell>
                              <TableCell className="text-blue-300">{row.impressions}</TableCell>
                              <TableCell className="text-yellow-300">
                                {(row.ctr ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-purple-300">
                                {(row.position ?? 0).toFixed(1)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      ))}
                  </tbody>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
