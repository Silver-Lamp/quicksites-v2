'use client';

import * as React from 'react';
import { format, addDays } from 'date-fns';
import type { Template } from '@/types/template';

/* ───────── types ───────── */
type Service  = { id: string; name: string; duration_minutes?: number };
type Resource = { id: string; name: string };
type Slot     = { starts_at: string; ends_at: string; resource_id?: string };

type Props = {
  block?: any;
  content?: any;
  template?: Template;
  /** Prefer passing the company_id explicitly on the live site */
  companyId?: string | null;
  /** Called when user selects a slot (you can open a modal/checkout here) */
  onSelectSlot?: (ctx: {
    companyId: string;
    service: Service;
    resource: Resource | { id: '__any__'; name: 'Any tech' };
    slot: Slot;
    tz: string;
  }) => void;
};

/* ───────── utils ───────── */
const ANY = '__any__';
const iso = (d = new Date()) => d.toISOString().slice(0, 10);

function coerceArray<T = any>(input: any): T[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as T[];
  if (Array.isArray(input.data)) return input.data as T[];
  if (Array.isArray(input.items)) return input.items as T[];
  if (Array.isArray(input.services)) return input.services as T[];
  if (Array.isArray(input.resources)) return input.resources as T[];
  if (typeof input === 'object') return Object.values(input) as T[];
  return [];
}
async function getJSON<T = any>(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/* ───────── live component ───────── */
export default function SchedulerLive({
  block,
  content,
  template,
  companyId: companyIdProp,
  onSelectSlot,
}: Props) {
  const companyId =
    companyIdProp ||
    (template as any)?.company_id ||
    (template as any)?.data?.company_id ||
    null;

  const tz = React.useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    []
  );

  const [date, setDate] = React.useState<string>(iso());
  const [services, setServices]   = React.useState<Service[]>([]);
  const [resources, setResources] = React.useState<Resource[]>([]);
  const [serviceId, setServiceId] = React.useState<string>('');
  const [resourceId, setResourceId] = React.useState<string>(ANY);

  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  /* theme (match your site) */
  const dark = (template as any)?.color_mode === 'dark';
  const shell   = dark ? 'bg-neutral-950 text-white border-white/10' : 'bg-white text-black border-neutral-200';
  const subText = dark ? 'text-neutral-300' : 'text-neutral-700';
  const zebra   = dark ? 'bg-neutral-900/40' : 'bg-neutral-100/50';
  const tableBd = dark ? 'border-white/10' : 'border-neutral-200';

  /* Load services/resources once per company */
  React.useEffect(() => {
    if (!companyId) return;
    const ac = new AbortController();
    (async () => {
      try {
        setErr(null);
        const [svcRaw, resRaw] = await Promise.all([
          getJSON(`/api/scheduler/services?company_id=${encodeURIComponent(companyId)}`, ac.signal),
          getJSON(`/api/scheduler/resources?company_id=${encodeURIComponent(companyId)}`, ac.signal),
        ]);
        const svc = coerceArray<Service>(svcRaw);
        const res = coerceArray<Resource>(resRaw);
        setServices(svc);
        setResources(res);
        if (!serviceId && svc.length) setServiceId(svc[0].id);
      } catch (e: any) {
        if (!ac.signal.aborted) setErr(e?.message || 'Failed to load booking data');
      }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  /* Load availability when inputs change */
  React.useEffect(() => {
    if (!companyId || !serviceId) return;
    const ac = new AbortController();
    (async () => {
      setLoading(true); setErr(null);
      try {
        const q = new URLSearchParams({
          company_id: companyId,
          service_id: serviceId,
          date,
          window_days: '1',
          tz,
          gran: '30',
          lead: '120',
        }).toString();
        const raw = await getJSON(`/api/scheduler/availability?${q}`, ac.signal);
        const arr = coerceArray<Slot>(raw?.slots ?? raw);
        setSlots(arr);
      } catch (e: any) {
        if (!ac.signal.aborted) {
          setSlots([]);
          setErr(e?.message || 'No availability');
        }
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [companyId, serviceId, date, tz]);

  const svc = services.find(s => s.id === serviceId) || null;
  const res = resourceId === ANY ? ({ id: ANY, name: 'Any tech' } as const)
                                : (resources.find(r => r.id === resourceId) || null);

  if (!companyId) {
    return (
      <section className={`rounded-2xl border ${shell}`}>
        <div className="p-6 text-sm text-amber-500">Booking is not available (no company linked).</div>
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border ${shell}`}>
      <div className="p-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {/* Service */}
          <label className="text-sm">
            <span className="block mb-1 font-medium">Service</span>
            <select
              className="w-full rounded-md border px-3 py-2 bg-transparent"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {services.length === 0 && <option value="">Loading…</option>}
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {/* Resource */}
          <label className="text-sm">
            <span className="block mb-1 font-medium">Resource</span>
            <select
              className="w-full rounded-md border px-3 py-2 bg-transparent"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
            >
              <option value={ANY}>Any tech</option>
              {resources.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </label>

          {/* Date nav */}
          <div className="text-sm">
            <span className="block mb-1 font-medium">Date</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border px-2 py-1"
                onClick={() => setDate(iso(addDays(new Date(date), -1)))}
              >
                ← Prev
              </button>
              <div className={`px-3 py-1 rounded-md border ${subText}`}>
                {format(new Date(date), 'EEE, MMM d')}
              </div>
              <button
                type="button"
                className="rounded-md border px-2 py-1"
                onClick={() => setDate(iso(addDays(new Date(date), +1)))}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Availability */}
        <div className="mt-2">
          <div className={`text-sm mb-2 ${subText}`}>
            {loading
              ? 'Loading availability…'
              : err
              ? err
              : slots.length
              ? `Available times for ${svc?.name ?? 'service'}`
              : 'No times today'}
          </div>

          {slots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {slots.map((slot, i) => (
                <button
                  key={`${slot.starts_at}-${i}`}
                  type="button"
                  className="rounded-md border px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => {
                    if (!svc) return;
                    onSelectSlot?.({
                      companyId,
                      service: svc,
                      resource: res || { id: ANY, name: 'Any tech' },
                      slot,
                      tz,
                    });
                  }}
                >
                  <div className="tabular-nums">{format(new Date(slot.starts_at), 'p')}</div>
                  <div className={`tabular-nums text-xs ${subText}`}>
                    {format(new Date(slot.ends_at), 'p')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className={`text-xs ${subText}`}>
          * Booking UI shown on the live site. The editor uses a read-only preview to keep things fast and stable.
        </p>
      </div>
    </section>
  );
}
