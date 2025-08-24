'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader, Search, RefreshCcw, ChevronLeft, ChevronRight, Timer, Slash, History } from 'lucide-react';

const DEFAULT_PER_PAGE = 50;
const PLAN_OPTIONS = [
  { key: 'free', label: 'Free' },
  { key: 'starter', label: 'Starter' },
  { key: 'pro', label: 'Pro' },
  { key: 'agency', label: 'Agency' },
];

type AnyRec = Record<string, any>;

type AdminUserRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  is_chef?: boolean;
  chef?: AnyRec | null;
  merchant?: AnyRec | null;
  compliance?: {
    profile?: AnyRec | null;
    snapshot?: AnyRec | null;
    overall?: string | null;
  } | null;
  plan?: {
    source?: 'user_plans' | 'subscriptions' | 'billing_subscriptions' | 'stripe_subscriptions' | 'unknown';
    key?: string | null; // normalized key/label
    label?: string | null; // human label if available
    status?: string | null;
    price_id?: string | null;
    current_period_end?: string | null;
    cancel_at?: string | null;
    trial_end?: string | null;
    updated_at?: string | null;
  } | null;
};

type ListResponse = {
  ok: boolean;
  page: number;
  perPage: number;
  count: number;
  hasMore: boolean;
  users: AdminUserRow[];
};

function useDebounce<T>(value: T, delay = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function LoadingOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-center justify-center">
      <div className="flex items-center gap-2 rounded-xl border p-4 bg-background shadow">
        <Loader className="h-4 w-4 animate-spin" />
        <span>Loading…</span>
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan?: AdminUserRow['plan'] | null }) {
  if (!plan) return <Badge variant="secondary">—</Badge>;
  const label = plan.label || plan.key || '—';
  const variant = plan.source === 'user_plans' ? 'default' : 'secondary';
  return (
    <Badge variant={variant as any} className="capitalize">
      {label}
    </Badge>
  );
}

export default function UsersPlansManager() {
  const [q, setQ] = useState('');
  const dq = useDebounce(q);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<ListResponse | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Trial dialogs
  const [trialOpen, setTrialOpen] = useState(false);
  const [trialUser, setTrialUser] = useState<AdminUserRow | null>(null);
  const [trialPlan, setTrialPlan] = useState<string>('pro');
  const [trialDays, setTrialDays] = useState<number>(7);

  const [extendOpen, setExtendOpen] = useState(false);
  const [extendUser, setExtendUser] = useState<AdminUserRow | null>(null);
  const [extendDays, setExtendDays] = useState<number>(7);

  const [endOpen, setEndOpen] = useState(false);
  const [endUser, setEndUser] = useState<AdminUserRow | null>(null);

  // Activity dialog
  const [actOpen, setActOpen] = useState(false);
  const [actUser, setActUser] = useState<AdminUserRow | null>(null);
  const [actItems, setActItems] = useState<any[]>([]);
  const [actLoading, setActLoading] = useState(false);

  const fetchUsers = React.useCallback(async (opts?: { resetPage?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const p = opts?.resetPage ? 1 : page;
      const url = new URL('/api/admin/users/list', window.location.origin);
      if (dq) url.searchParams.set('q', dq);
      url.searchParams.set('page', String(p));
      url.searchParams.set('perPage', String(perPage));
      const r = await fetch(url.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error(`List failed (${r.status})`);
      const j: ListResponse = await r.json();
      setRes(j);
      if (opts?.resetPage) setPage(1);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [dq, page, perPage]);

  useEffect(() => {
    fetchUsers({ resetPage: true });
  }, [dq, perPage]);

  // Fetch on page change
  useEffect(() => {
    fetchUsers();
  }, [page]);

  const users = res?.users ?? [];

  async function updatePlan(userId: string, planKey: string) {
    setSaving((s) => ({ ...s, [userId]: true }));
    try {
      const r = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan_key: planKey }),
      });
      if (r.status === 501) {
        const j = await r.json();
        alert(j?.error ?? 'Plan update not implemented (missing user_plans table).');
        return;
      }
      if (!r.ok) throw new Error(`Update failed (${r.status})`);
      const j = await r.json();
      setRes((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  plan: {
                    ...(u.plan ?? {}),
                    source: 'user_plans',
                    key: planKey,
                    label: planKey,
                    status: j?.plan?.status ?? u.plan?.status ?? 'active',
                    trial_end: j?.plan?.trial_end ?? u.plan?.trial_end ?? null,
                    updated_at: new Date().toISOString(),
                  },
                }
              : u
          ),
        };
      });
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update plan');
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  }

  function openTrial(u: AdminUserRow) {
    setTrialUser(u);
    setTrialPlan(u.plan?.key ?? 'pro');
    setTrialDays(7);
    setTrialOpen(true);
  }

  function openExtend(u: AdminUserRow) {
    setExtendUser(u);
    setExtendDays(7);
    setExtendOpen(true);
  }

  function openEnd(u: AdminUserRow) {
    setEndUser(u);
    setEndOpen(true);
  }

  async function confirmTrial() {
    if (!trialUser) return;
    setSaving((s) => ({ ...s, [trialUser.id]: true }));
    try {
      const r = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: trialUser.id,
          plan_key: trialPlan,
          status: 'trialing',
          trial_days: trialDays,
          log_action: 'set_trial',
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${r.status})`);
      }
      const j = await r.json();
      const trial_end = j?.plan?.trial_end ?? null;
      setRes((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.id === trialUser.id
              ? {
                  ...u,
                  plan: {
                    ...(u.plan ?? {}),
                    source: 'user_plans',
                    key: trialPlan,
                    label: trialPlan,
                    status: 'trialing',
                    trial_end,
                    updated_at: new Date().toISOString(),
                  },
                }
              : u
          ),
        };
      });
      setTrialOpen(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to set trial');
    } finally {
      setSaving((s) => ({ ...s, [trialUser!.id]: false }));
    }
  }

  async function confirmExtend() {
    if (!extendUser) return;
    setSaving((s) => ({ ...s, [extendUser.id]: true }));
    try {
      const r = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: extendUser.id,
          plan_key: extendUser.plan?.key ?? 'pro',
          extend_days: extendDays,
          status: 'trialing',
          log_action: 'extend_trial',
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${r.status})`);
      }
      const j = await r.json();
      const trial_end = j?.plan?.trial_end ?? null;
      setRes((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) =>
            u.id === extendUser.id
              ? {
                  ...u,
                  plan: {
                    ...(u.plan ?? {}),
                    source: 'user_plans',
                    key: extendUser.plan?.key ?? 'pro',
                    label: extendUser.plan?.label ?? extendUser.plan?.key ?? 'pro',
                    status: 'trialing',
                    trial_end,
                    updated_at: new Date().toISOString(),
                  },
                }
              : u
          ),
        };
      });
      setExtendOpen(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to extend trial');
    } finally {
      setSaving((s) => ({ ...s, [extendUser!.id]: false }));
    }
  }

  async function quickExtend(u: AdminUserRow, days = 7) {
    setSaving((s) => ({ ...s, [u.id]: true }));
    try {
      const r = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: u.id,
          plan_key: u.plan?.key ?? 'pro',
          extend_days: days,
          status: 'trialing',
          log_action: 'extend_trial_quick',
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${r.status})`);
      }
      const j = await r.json();
      const trial_end = j?.plan?.trial_end ?? null;
      setRes((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((x) =>
            x.id === u.id
              ? {
                  ...x,
                  plan: {
                    ...(x.plan ?? {}),
                    source: 'user_plans',
                    key: u.plan?.key ?? 'pro',
                    label: u.plan?.label ?? u.plan?.key ?? 'pro',
                    status: 'trialing',
                    trial_end,
                    updated_at: new Date().toISOString(),
                  },
                }
              : x
          ),
        };
      });
    } catch (e: any) {
      alert(e?.message ?? 'Failed to extend trial');
    } finally {
      setSaving((s) => ({ ...s, [u.id]: false }));
    }
  }

  async function endTrialNow(mode: 'free' | 'activate') {
    if (!endUser) return;
    setSaving((s) => ({ ...s, [endUser.id]: true }));
    try {
      const r = await fetch('/api/admin/users/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: endUser.id,
          plan_key: endUser.plan?.key ?? 'pro',
          end_mode: mode,
          log_action: 'end_trial',
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `Failed (${r.status})`);
      }
      // optimistic UI based on mode
      setRes((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.map((u) => {
            if (u.id !== endUser.id) return u;
            if (mode === 'free') {
              return {
                ...u,
                plan: {
                  source: 'user_plans',
                  key: 'free',
                  label: 'free',
                  status: 'none',
                  trial_end: null,
                  updated_at: new Date().toISOString(),
                },
              };
            }
            return {
              ...u,
              plan: {
                ...(u.plan ?? {}),
                source: 'user_plans',
                key: u.plan?.key ?? 'pro',
                label: u.plan?.label ?? u.plan?.key ?? 'pro',
                status: 'active',
                trial_end: null,
                updated_at: new Date().toISOString(),
              },
            };
          }),
        };
      });
      setEndOpen(false);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to end trial');
    } finally {
      setSaving((s) => ({ ...s, [endUser!.id]: false }));
    }
  }

  async function openActivity(u: AdminUserRow) {
    setActUser(u);
    setActItems([]);
    setActLoading(true);
    setActOpen(true);
    try {
      const url = new URL('/api/admin/users/logs', window.location.origin);
      url.searchParams.set('user_id', u.id);
      url.searchParams.set('limit', '50');
      const r = await fetch(url.toString(), { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `Failed (${r.status})`);
      setActItems(j?.logs ?? []);
    } catch (e) {
      setActItems([]);
    } finally {
      setActLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <LoadingOverlay show={loading} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Users & Plans</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by email or name…"
                className="pl-8 w-[260px]"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
            </div>
            <Button variant="outline" onClick={() => fetchUsers()}>
              <RefreshCcw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Compliance</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const planSrc = u.plan?.source ?? 'unknown';
                  const editable = planSrc === 'user_plans';
                  const savingThis = !!saving[u.id];
                  const planKey = u.plan?.key ?? u.plan?.label ?? undefined;
                  const isTrial = u.plan?.status === 'trialing';
                  const trialEndISO = u.plan?.trial_end || undefined;
                  const trialExpired = isTrial && trialEndISO ? new Date(trialEndISO).getTime() < Date.now() : false;

                  return (
                    <div key={u.id} className="border-b border-zinc-500/30">
                    <TableRow className="align-top">
                      <TableCell>
                        <div className="font-medium">{u.name ?? '—'}</div>
                        <div className="text-muted-foreground text-sm">{u.email ?? '—'}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{u.id}</div>
                      </TableCell>

                      <TableCell className="space-x-2">
                        {u.is_chef ? (
                          <Badge variant="default">Chef</Badge>
                        ) : (
                          <Badge variant="secondary">User</Badge>
                        )}
                        {u.merchant?.id && <Badge variant="outline">Merchant</Badge>}
                      </TableCell>

                      <TableCell>
                        {u.compliance?.overall ? (
                          <Badge
                            variant={
                              u.compliance.overall === 'good'
                                ? 'default'
                                : u.compliance.overall === 'pending'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {u.compliance.overall}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <PlanBadge plan={u.plan} />
                          {editable ? (
                            <Select
                              value={planKey}
                              onValueChange={(val) => updatePlan(u.id, val)}
                              disabled={savingThis}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Set plan…" />
                              </SelectTrigger>
                              <SelectContent>
                                {PLAN_OPTIONS.map((p) => (
                                  <SelectItem key={p.key} value={p.key}>
                                    {p.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {planSrc === 'unknown' ? '—' : 'Stripe-managed'}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {u.plan?.status ? (
                          <Badge
                            variant={
                              trialExpired
                                ? 'destructive'
                                : u.plan.status === 'active'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {trialExpired ? 'trial expired' : u.plan.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {isTrial && trialEndISO && (
                          <div className="text-xs text-muted-foreground mt-1">
                            trial ends {formatWhen(trialEndISO)}
                          </div>
                        )}
                        {!isTrial && u.plan?.current_period_end && (
                          <div className="text-xs text-muted-foreground mt-1">
                            renews {formatWhen(u.plan.current_period_end)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(u.id)}>
                            Copy ID
                          </Button>
                          <Button size="sm" onClick={() => openTrial(u)}>
                            Trial upgrade
                          </Button>
                          {isTrial && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => openExtend(u)} title="Extend trial">
                                <Timer className="h-4 w-4 mr-1" /> Extend
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => quickExtend(u, 7)} title="Extend 7 days">
                                <Timer className="h-4 w-4 mr-1" /> +7d
                              </Button>
                              <Button variant="destructive" size="sm" onClick={() => openEnd(u)} title="End trial now">
                                <Slash className="h-4 w-4 mr-1" /> End
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openActivity(u)} title="View activity logs">
                            <History className="h-4 w-4 mr-1" /> Logs
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    </div>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {users.length} of {res?.count ?? 0}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <div className="text-sm">Page {page}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!res?.hasMore}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trial Upgrade Dialog */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trial Upgrade</DialogTitle>
            <DialogDescription>
              Temporarily upgrade this user without Stripe. Choose a plan and when the trial should end.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan</Label>
                <Select value={trialPlan} onValueChange={setTrialPlan}>
                  <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.filter(p => p.key !== 'free').map((p) => (
                      <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={trialDays}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setTrialDays(Number.isFinite(n) && n > 0 ? n : 7);
                  }}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialOpen(false)}>Cancel</Button>
            <Button onClick={confirmTrial} disabled={!trialUser || saving[trialUser?.id ?? '']}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Trial Dialog */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Trial</DialogTitle>
            <DialogDescription>
              Add days to the current trial. If there is no active trial end, extension starts from now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Extend by (days)</Label>
              <Input
                type="number"
                min={1}
                value={extendDays}
                onChange={(e) => setExtendDays(Math.max(1, Number(e.target.value || 1)))}
                className="mt-1"
              />
            </div>
            {extendUser?.plan?.trial_end && (
              <p className="text-xs text-muted-foreground">
                Current trial ends {formatWhen(extendUser.plan.trial_end)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendOpen(false)}>Cancel</Button>
            <Button onClick={confirmExtend} disabled={!extendUser || saving[extendUser?.id ?? '']}>Extend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Trial Dialog */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Trial Now</DialogTitle>
            <DialogDescription>
              Choose what happens after ending the trial.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
            <Button variant="secondary" onClick={() => endTrialNow('activate')} disabled={!endUser || saving[endUser?.id ?? '']}>
              Activate Pro
            </Button>
            <Button variant="destructive" onClick={() => endTrialNow('free')} disabled={!endUser || saving[endUser?.id ?? '']}>
              Downgrade to Free
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEndOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog open={actOpen} onOpenChange={setActOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity log</DialogTitle>
            <DialogDescription>
              Recent actions for {actUser?.email || actUser?.id}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-[120px] max-h-[60vh] overflow-y-auto">
            {actLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : actItems.length === 0 ? (
              <div className="text-sm text-muted-foreground">No recent activity.</div>
            ) : (
              <ul className="space-y-2">
                {actItems.map((log: any) => (
                  <li key={log.id} className="rounded border border-zinc-700 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{log.action}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</div>
                    </div>
                    {log.actor_id && (
                      <div className="text-xs text-muted-foreground mt-1">actor: {log.actor_id}</div>
                    )}
                    {log.meta && (
                      <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap text-muted-foreground">{JSON.stringify(log.meta, null, 2)}</pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' });
    return fmt.format(d);
  } catch {
    return iso;
  }
}

function formatDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return iso;
  }
}