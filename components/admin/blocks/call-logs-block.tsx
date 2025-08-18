'use client';

import { useEffect, useState } from 'react';
import { getSupabaseRSC } from '@/lib/supabase/serverClient';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CallLog = {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: string;
  call_status: string;
  call_duration: number;
  timestamp: string;
};

export default async function CallLogsBlock() {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = await getSupabaseRSC();

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(25);

      if (!error && data) setLogs(data);
      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <Card className="p-2">
      <CardContent>
        <h2 className="text-lg font-semibold mb-2">📞 Recent Calls</h2>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-muted-foreground">No calls logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.call_sid}>
                    <TableCell>{log.from_number}</TableCell>
                    <TableCell>{log.to_number}</TableCell>
                    <TableCell className="capitalize">{log.direction}</TableCell>
                    <TableCell className="capitalize">{log.call_status}</TableCell>
                    <TableCell className="text-right">{log.call_duration ?? '-'} sec</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
