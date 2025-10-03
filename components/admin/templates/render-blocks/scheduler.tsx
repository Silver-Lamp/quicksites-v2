// components/admin/templates/render-blocks/scheduler.tsx
'use client';

import * as React from 'react';
import { format } from 'date-fns';
import type { Template } from '@/types/template';

type Service = { id: string; name: string; duration_minutes?: number };
type Resource = { id: string; name: string };
type Slot = { starts_at: string; ends_at: string; resource_id?: string };

type Props = {
  block?: any;
  content?: any;
  template?: Template;
  companyId?: string;    // preferred owner
  orgId?: string;        // legacy owner (compat)
  previewOnly?: boolean; // editor surface passes true
};

/* ---------------- small utils ---------------- */
const ANY = '__any__';
const toISODate = (d = new Date()) => d.toISOString().slice(0, 10);

/** Coerce many possible API payloads into a flat array */
function coerceArray<T = any>(input: any): T[] {
  if (!input) return [];
  if (Array.isArray(input)) return input as T[];
  // common wrappers
  if (Array.isArray(input.data)) return input.data as T[];
  if (Array.isArray(input.items)) return input.items as T[];
  if (Array.isArray(input.services)) return input.services as T[];
  if (Array.isArray(input.resources)) return input.resources as T[];
  // keyed object { id1: {...}, id2: {...} }
  if (typeof input === 'object') {
    const vals = Object.values(input);
    return Array.isArray(vals) ? (vals as T[]) : [];
  }
  return [];
}

async function fetchJSON(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ======================================================================= */

export default function SchedulerRender({
  block,
  content,
  template,
  companyId: companyIdProp,
  orgId,
  previewOnly = true,
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

  const [date] = React.useState<string>(toISODate());
  const [services, setServices] = React.useState<Service[]>([]);
  const [resources, setResources] = React.useState<Resource[]>([]);
  const [serviceId, setServiceId] = React.useState<string | null>(null);
  const [resourceId] = React.useState<string>(ANY);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  /* ---------- load services/resources ---------- */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!companyId) return;
        const svcRaw = await fetchJSON(`/api/scheduler/services?company_id=${encodeURIComponent(companyId)}`);
        const resRaw = await fetchJSON(`/api/scheduler/resources?company_id=${encodeURIComponent(companyId)}`);

        const svcArr = coerceArray<Service>(svcRaw);
        const resArr = coerceArray<Resource>(resRaw);

        if (!alive) return;
        setServices(svcArr);
        setResources([{ id: ANY, name: 'Any tech' }, ...resArr]);
        if (!serviceId && svcArr.length) setServiceId(svcArr[0].id);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'Failed to load scheduler data');
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  /* ---------- load availability (best-effort; won't throw UI) ---------- */
  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!companyId || !serviceId) return;
        setLoading(true);
        setErr(null);

        const q = new URLSearchParams({
          company_id: companyId,
          service_id: serviceId,
          date,
          window_days: '1',
          tz,
          gran: '30',
          lead: '120',
        }).toString();

        const raw = await fetchJSON(`/api/scheduler/availability?${q}`);
        const arr = coerceArray<Slot>(raw?.slots ?? raw);
        if (!alive) return;
        setSlots(arr);
      } catch (e: any) {
        if (!alive) return;
        setSlots([]);
        // leave a soft error; this endpoint may not be ready yet
        setErr(e?.message || 'Availability unavailable');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [companyId, serviceId, date, tz]);

  /* ---------- theming ---------- */
  const effectiveMode: 'light' | 'dark' =
    (template as any)?.color_mode === 'dark' ? 'dark' : 'light';
  const shellCls =
    effectiveMode === 'light'
      ? 'bg-white text-black border border-neutral-200'
      : 'bg-neutral-950 text-white border border-white/10';
  const subTextCls = effectiveMode === 'light' ? 'text-neutral-700' : 'text-neutral-300';
  const zebra = effectiveMode === 'light' ? 'bg-neutral-100/50' : 'bg-neutral-900/40';
  const tableBorder = effectiveMode === 'light' ? 'border-neutral-200' : 'border-white/10';

  /* ---------- PREVIEW-ONLY (read-only, editor-safe) ---------- */
  const svcName =
    services.length === 0
      ? 'No services'
      : (services.find((s) => s.id === serviceId)?.name ?? services[0].name);

  const resName =
    resourceId === ANY
      ? 'Any tech'
      : resources.find((r) => r.id === resourceId)?.name ?? 'Any tech';

  return (
    <section className={`rounded-2xl ${shellCls}`}>
      <div className="p-6 space-y-3">
        {!companyId && (
          <div className="text-sm text-amber-500">
            Connect a company to enable booking (no company_id found).
          </div>
        )}

        <div className="text-sm">
          <div className="mb-1 font-medium">Booking (preview)</div>
          <div className={subTextCls}>Service: {svcName}</div>
          <div className={subTextCls}>Resource: {resName}</div>
          <div className={subTextCls}>Date: {format(new Date(date), 'EEE, MMM d')}</div>
        </div>

        <div className={`mt-3 overflow-hidden rounded-xl border ${tableBorder}`}>
          <table className="w-full text-sm">
            <thead className={effectiveMode === 'light' ? 'bg-neutral-100/70' : 'bg-neutral-900/50'}>
              <tr>
                <th className="px-4 py-2 text-left">Start</th>
                <th className="px-4 py-2 text-left">End</th>
                <th className="px-4 py-2 text-left">Resource</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-4 py-3" colSpan={3}>Loading…</td></tr>
              ) : err ? (
                <tr><td className="px-4 py-3 text-rose-400" colSpan={3}>{String(err)}</td></tr>
              ) : slots.length === 0 ? (
                <tr><td className="px-4 py-3 opacity-70" colSpan={3}>No slots</td></tr>
              ) : (
                slots.map((s, i) => (
                  <tr key={`${s.starts_at}-${i}`} className={i % 2 ? zebra : ''}>
                    <td className="px-4 py-3 tabular-nums">{format(new Date(s.starts_at), 'p')}</td>
                    <td className="px-4 py-3 tabular-nums">{format(new Date(s.ends_at), 'p')}</td>
                    <td className="px-4 py-3">
                      {s.resource_id
                        ? (resources.find((r) => r.id === s.resource_id)?.name ?? '—')
                        : 'Any tech'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={`text-xs ${subTextCls}`}>
          * Preview is read-only inside the editor. Booking inputs are enabled on the live site.
        </div>
      </div>
    </section>
  );
}
