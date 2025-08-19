'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ShareMenu from '@/components/public/share-menu';

type Meal = {
  id: string;
  title: string;
  slug?: string | null;
  price_cents: number;
  auto_last_call?: boolean | null;
};
type Sched = {
  id: string;
  network: string;
  kind: string;
  scheduled_for: string;
  status: string;
  text: string;
  link_url: string;
};
type Hook = { id: string; name: string; kind: 'slack' | 'discord' | 'generic' };

export default function PostScheduleTab({ siteId }: { siteId: string }) {
  // 🔧 moved here (inside component)
  const [hooks, setHooks] = React.useState<Hook[]>([]);
  const [selectedHooks, setSelectedHooks] = React.useState<string[]>([]);

  const [meals, setMeals] = React.useState<Meal[]>([]);
  const [mealId, setMealId] = React.useState<string>('');
  const [whenISO, setWhenISO] = React.useState<string>('');
  const [netX, setNetX] = React.useState(true);
  const [caption, setCaption] = React.useState('');
  const [autoLastCall, setAutoLastCall] = React.useState(true);
  const [schedules, setSchedules] = React.useState<Sched[]>([]);
  const [selectedMeal, setSelectedMeal] = React.useState<Meal | null>(null);

  const loadHooks = React.useCallback(async () => {
    try {
      const r = await fetch('/api/chef/social/webhooks/list', { cache: 'no-store' });
      const d = await r.json();
      setHooks((d?.webhooks ?? []).map((h: any) => ({ id: h.id, name: h.name, kind: h.kind })));
    } catch {
      setHooks([]);
    }
  }, []);

  async function loadMeals() {
    const r = await fetch(`/api/chef/meals/list?siteId=${encodeURIComponent(siteId)}`, { cache: 'no-store' });
    const d = await r.json();
    const arr: Meal[] = (d?.meals ?? []).map((m: any) => ({
      id: m.id,
      title: m.title,
      slug: m.slug,
      price_cents: m.price_cents,
      auto_last_call: m.auto_last_call,
    }));
    setMeals(arr);
  }

  async function loadSchedules() {
    const r = await fetch('/api/chef/schedule/list', { cache: 'no-store' });
    const d = await r.json();
    setSchedules(d?.posts ?? []);
  }

  // load initial data
  React.useEffect(() => {
    loadHooks();
  }, [loadHooks]);

  React.useEffect(() => {
    loadMeals();
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  // sync selected meal → caption defaults & auto-last-call
  React.useEffect(() => {
    const m = meals.find((x) => x.id === mealId) || null;
    setSelectedMeal(m);
    if (m) {
      setCaption(
        `🍽️ ${m.title} is LIVE on delivered.menu — $${(m.price_cents / 100).toFixed(2)}. Limited portions.`
      );
      setAutoLastCall(m.auto_last_call !== false);
    }
  }, [mealId, meals]);

  const handle = selectedMeal?.slug || selectedMeal?.id || '';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || '';
  const pageUrl = handle ? `${origin}/meals/${handle}` : origin;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 space-y-3">
        <h3 className="text-base font-semibold">Schedule a drop post</h3>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Meal</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              value={mealId}
              onChange={(e) => setMealId(e.target.value)}
            >
              <option value="">Select…</option>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Post time</Label>
            <Input type="datetime-local" value={whenISO} onChange={(e) => setWhenISO(e.target.value)} />
          </div>

          <div>
            <Label>Networks</Label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={netX} onChange={(e) => setNetX(e.target.checked)} /> X (Twitter)
            </label>
            <div className="text-xs text-muted-foreground">Connect X in Dashboard → Social to enable.</div>
          </div>

          <div className="mt-2 sm:col-span-3">
            <div className="mb-1 text-xs text-muted-foreground">Webhooks</div>
            {hooks.length === 0 ? (
              <div className="text-xs text-muted-foreground">No connectors yet.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hooks.map((h) => {
                  const on = selectedHooks.includes(h.id);
                  return (
                    <label
                      key={h.id}
                      className={[
                        'cursor-pointer rounded-md border px-2 py-1 text-xs',
                        on ? 'bg-primary text-primary-foreground' : 'bg-background',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={on}
                        onChange={() =>
                          setSelectedHooks((prev) => (on ? prev.filter((x) => x !== h.id) : [...prev, h.id]))
                        }
                      />
                      {h.name} ({h.kind})
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <Label>Caption</Label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoLastCall}
              onChange={(e) => setAutoLastCall(e.target.checked)}
            />
            Auto last-call when ≤ 3
          </label>
          {selectedMeal && <ShareMenu url={pageUrl} title={selectedMeal.title} />}
        </div>

        <div className="pt-2">
          <Button
            onClick={async () => {
              const nets: string[] = [];
              if (netX) nets.push('x');
              if (!mealId || !whenISO || (nets.length === 0 && selectedHooks.length === 0)) {
                return alert('Pick a meal, a time, and at least one channel');
              }
              const r = await fetch('/api/chef/schedule/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  mealId,
                  whenISO,
                  networks: nets,
                  webhooks: selectedHooks,
                  caption,
                  autoLastCall,
                }),
              });
              if (r.ok) {
                await loadSchedules();
                alert('Scheduled');
              } else {
                const d = await r.json().catch(() => ({}));
                alert(d?.error || 'Failed to schedule');
              }
            }}
          >
            Schedule
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <h3 className="mb-2 text-base font-semibold">Upcoming & recent posts</h3>
        {!schedules.length ? (
          <div className="text-sm text-muted-foreground">No posts yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Network</th>
                  <th className="py-2 pr-4">Kind</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Text</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} className="border-t align-top">
                    <td className="py-2 pr-4">{new Date(s.scheduled_for).toLocaleString()}</td>
                    <td className="py-2 pr-4">{s.network}</td>
                    <td className="py-2 pr-4">{s.kind}</td>
                    <td className="py-2 pr-4">{s.status}</td>
                    <td className="max-w-xl truncate py-2 pr-4" title={s.text}>
                      {s.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
