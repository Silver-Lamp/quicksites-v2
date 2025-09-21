// components/admin/templates/render-blocks/scheduler.tsx
'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import type { Template } from '@/types/template';
import type { SchedulerBlock } from '@/admin/lib/zod/blockSchema';
import { Button, Select, SelectItem } from '@/components/ui'; // adapt to your UI lib

type Props = {
  // In preview/editor we get the full block; in some callsites we may pass content directly.
  block?: any;
  content?: any;
  template?: Template;
  orgId?: string;
  previewOnly?: boolean;
};

type Service = { id: string; name: string; duration_minutes: number };
type Resource = { id: string; name: string };

type Slot = {
  starts_at: string; // ISO
  ends_at: string;   // ISO
  resource_id?: string;
};

const DEFAULTS: SchedulerBlock = {
  title: 'Book an appointment',
  subtitle: 'Choose a time that works for you',
  org_id: undefined,
  service_ids: [],
  default_service_id: undefined,
  show_resource_picker: false,
  timezone: 'America/Los_Angeles',
  slot_granularity_minutes: 30,
  lead_time_minutes: 120,
  window_days: 14,
  confirmation_message: 'Thanks! Your appointment is confirmed.',
};

export default function SchedulerRender(props: Props) {
  // Pull canonical content safely (works whether caller passes whole block or just content)
  const b: SchedulerBlock = useMemo(() => {
    const raw =
      (props.content && typeof props.content === 'object' ? props.content : undefined) ??
      (props.block?.content && typeof props.block.content === 'object' ? props.block.content : undefined) ??
      (props.block && typeof props.block === 'object' && !props.block.type ? props.block : undefined) ??
      {};
    return { ...DEFAULTS, ...(raw as any) };
  }, [props.block, props.content]);

  const effectiveOrgId = b.org_id ?? props.orgId ?? undefined;
  const serviceIds = Array.isArray(b.service_ids) ? b.service_ids : [];

  const [services, setServices] = useState<Service[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [serviceId, setServiceId] = useState<string | undefined>(b.default_service_id);
  const [resourceId, setResourceId] = useState<string | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch services/resources
  useEffect(() => {
    (async () => {
      const qs = new URLSearchParams();
      if (serviceIds.length) qs.set('service_ids', serviceIds.join(','));
      if (effectiveOrgId) qs.set('org_id', effectiveOrgId);

      const [svcRes, resRes] = await Promise.all([
        fetch(`/api/scheduler/services?${qs.toString()}`).then(r => r.json()).catch(() => ({ rows: [] })),
        fetch(`/api/scheduler/resources?${qs.toString()}`).then(r => r.json()).catch(() => ({ rows: [] })),
      ]);

      const svcRows: Service[] = Array.isArray(svcRes?.rows) ? svcRes.rows : [];
      const resRows: Resource[] = Array.isArray(resRes?.rows) ? resRes.rows : [];

      setServices(svcRows);
      setResources(resRows);

      // pick a default if none chosen yet
      if (!serviceId && svcRows[0]?.id) setServiceId(svcRows[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(serviceIds), effectiveOrgId]);

  // Query availability for chosen day
  useEffect(() => {
    if (!serviceId) { setSlots([]); return; }
    setLoading(true);

    const qs = new URLSearchParams();
    qs.set('service_id', serviceId);
    qs.set('date', date);
    qs.set('window_days', '1');
    qs.set('tz', b.timezone);
    qs.set('gran', String(b.slot_granularity_minutes));
    qs.set('lead', String(b.lead_time_minutes));
    if (effectiveOrgId) qs.set('org_id', effectiveOrgId);
    if (b.show_resource_picker && resourceId) qs.set('resource_id', resourceId);

    fetch(`/api/scheduler/availability?${qs.toString()}`)
      .then(r => r.json())
      .then(d => setSlots(Array.isArray(d?.slots) ? d.slots : []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [
    serviceId,
    date,
    resourceId,
    b.timezone,
    b.slot_granularity_minutes,
    b.lead_time_minutes,
    b.show_resource_picker,
    effectiveOrgId,
  ]);

  const days = useMemo(
    () => Array.from({ length: Math.max(1, b.window_days) }, (_, i) => addDays(new Date(), i)),
    [b.window_days]
  );

  async function book(slot: Slot) {
    const name = (document.getElementById('sched-name') as HTMLInputElement)?.value?.trim();
    const email = (document.getElementById('sched-email') as HTMLInputElement)?.value?.trim();
    const phone = (document.getElementById('sched-phone') as HTMLInputElement)?.value?.trim();

    if (!name || !serviceId) return alert('Please enter your name and choose a time.');

    const res = await fetch(`/api/scheduler/book`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        org_id: effectiveOrgId,
        service_id: serviceId,
        resource_id: b.show_resource_picker ? (resourceId ?? slot.resource_id) : slot.resource_id,
        customer_name: name,
        customer_email: email || undefined,
        customer_phone: phone || undefined,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
      }),
    });

    if (res.ok) {
      alert(b.confirmation_message);
      setSlots((prev) => prev?.filter(s => !(s.starts_at === slot.starts_at && s.resource_id === slot.resource_id)) ?? prev);
    } else {
      const msg = await res.text();
      alert(msg || 'Could not book — please pick another time.');
    }
  }

  return (
    <div className="w-full rounded-2xl border p-6">
      <h3 className="text-2xl font-semibold">{b.title}</h3>
      {b.subtitle && <p className="text-muted-foreground">{b.subtitle}</p>}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-sm font-medium">Service</label>
          <Select value={serviceId} onValueChange={setServiceId}>
            {services.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </Select>

          {b.show_resource_picker && (
            <>
              <label className="block text-sm font-medium">Preferred Resource</label>
              <Select value={resourceId} onValueChange={setResourceId}>
                <SelectItem value="">Any</SelectItem>
                {resources.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </Select>
            </>
          )}

          <label className="block text-sm font-medium">Pick a Day</label>
          <Select value={date} onValueChange={setDate}>
            {days.map(d => {
              const val = format(d, 'yyyy-MM-dd');
              return <SelectItem key={val} value={val}>{format(d, 'EEE, MMM d')}</SelectItem>;
            })}
          </Select>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Your Name *</label>
            <input id="sched-name" placeholder="Jane Doe" />
            <div className="grid grid-cols-2 gap-2">
              <input id="sched-email" placeholder="you@email.com" />
              <input id="sched-phone" placeholder="(555) 555-5555" />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Available Times</div>
          {loading && <div className="text-sm">Loading...</div>}
          {!loading && (!slots || slots.length === 0) && (
            <div className="text-sm text-muted-foreground">No times available for this day. Try another date.</div>
          )}
          <div className="flex flex-wrap gap-2">
            {slots?.map((s) => {
              const label = new Date(s.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return (
                <Button key={`${s.starts_at}-${s.resource_id}`} size="sm" onClick={() => book(s)}>
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
