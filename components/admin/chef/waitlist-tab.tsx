'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type Row = { meal_id: string; title: string; active_count: number; queued_count: number; notified_count: number; unsub_count: number; };
type Sub = { id: string; email: string; status: string; created_at: string; notified_at: string | null };

export default function WaitlistTab({ siteId }: { siteId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [openMeal, setOpenMeal] = useState<string | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [subStatus, setSubStatus] = useState<'active'|'queued'|'notified'|'unsubscribed'>('active');
  const [loadingSubs, setLoadingSubs] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ siteId });
      const r = await fetch(`/api/chef/waitlist/summary?${qs.toString()}`);
      const data = await r.json();
      setRows(data?.rows ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [siteId]);

  async function open(mealId: string) {
    setOpenMeal(mealId);
    setLoadingSubs(true);
    try {
      const qs = new URLSearchParams({ mealId, status: subStatus });
      const r = await fetch(`/api/chef/waitlist/list?${qs.toString()}`);
      const data = await r.json();
      setSubs(data?.subs ?? []);
    } finally { setLoadingSubs(false); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4">
        <h2 className="text-base font-semibold mb-2">Waitlist Overview</h2>
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : !rows.length ? (
          <div className="text-sm text-muted-foreground">No waitlist activity yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Meal</th>
                  <th className="py-2 pr-4">Active</th>
                  <th className="py-2 pr-4">Queued</th>
                  <th className="py-2 pr-4">Notified</th>
                  <th className="py-2 pr-4">Unsub</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.meal_id} className="border-t">
                    <td className="py-2 pr-4">{r.title}</td>
                    <td className="py-2 pr-4">{r.active_count}</td>
                    <td className="py-2 pr-4">{r.queued_count}</td>
                    <td className="py-2 pr-4">{r.notified_count}</td>
                    <td className="py-2 pr-4">{r.unsub_count}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => open(r.meal_id)}>View</Button>
                        <a
                          className="inline-flex items-center rounded-md border px-3 py-1 text-xs"
                          href={`/api/chef/waitlist/export?mealId=${r.meal_id}&status=active`}
                        >
                          Export CSV
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openMeal && (
        <div className="rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Subscribers</h3>
            <div className="flex items-center gap-2">
              <Label htmlFor="st" className="text-xs">Status</Label>
              <select
                id="st"
                className="rounded-md border px-2 py-1 text-xs"
                value={subStatus}
                onChange={async (e) => {
                  const v = e.target.value as any;
                  setSubStatus(v);
                  setLoadingSubs(true);
                  const qs = new URLSearchParams({ mealId: openMeal!, status: v });
                  const r = await fetch(`/api/chef/waitlist/list?${qs.toString()}`);
                  const data = await r.json();
                  setSubs(data?.subs ?? []);
                  setLoadingSubs(false);
                }}
              >
                <option value="active">active</option>
                <option value="queued">queued</option>
                <option value="notified">notified</option>
                <option value="unsubscribed">unsubscribed</option>
              </select>
              <Button size="sm" variant="outline" onClick={() => setOpenMeal(null)}>Close</Button>
            </div>
          </div>
          {loadingSubs ? (
            <div className="text-sm text-muted-foreground mt-3">Loading…</div>
          ) : !subs.length ? (
            <div className="text-sm text-muted-foreground mt-3">No subscribers.</div>
          ) : (
            <div className="overflow-x-auto mt-3">
              <table className="min-w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Joined</th>
                    <th className="py-2 pr-4">Notified</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map(s => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2 pr-4">{s.email}</td>
                      <td className="py-2 pr-4">{s.status}</td>
                      <td className="py-2 pr-4">{new Date(s.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{s.notified_at ? new Date(s.notified_at).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
