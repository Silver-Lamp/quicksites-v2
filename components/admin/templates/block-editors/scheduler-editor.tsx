'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import { SchedulerBlock } from '@/admin/lib/zod/blockSchema';
import { Select, SelectItem, Button } from '@/components/ui'; // adjust to your UI set
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import toast from 'react-hot-toast';

type Props = {
  block: Block;
  onChange: (next: Partial<SchedulerBlock>) => void;
  orgId?: string;
  template?: Template; // ⬅️ needed to read template.meta.services
};

type ServiceOpt = { id: string; name: string };

function extractTemplateServices(template?: any): string[] {
  if (!template) return [];
  const names = new Set<string>();

  // services_jsonb column (array or JSON string)
  const sj = (template as any).services_jsonb;
  if (Array.isArray(sj)) sj.forEach((s) => typeof s === 'string' && names.add(s.trim()));
  if (typeof sj === 'string') {
    try {
      const arr = JSON.parse(sj);
      if (Array.isArray(arr)) arr.forEach((s) => typeof s === 'string' && names.add(s.trim()));
    } catch {}
  }

  // services column (text JSON)
  const sTxt = (template as any).services;
  if (typeof sTxt === 'string' && sTxt.trim()) {
    try {
      const arr = JSON.parse(sTxt);
      if (Array.isArray(arr)) arr.forEach((s) => typeof s === 'string' && names.add(s.trim()));
    } catch {}
  }

  // data / meta.services
  const data = (() => {
    const d = (template as any).data;
    if (d && typeof d === 'object') return d;
    if (typeof d === 'string') { try { return JSON.parse(d); } catch { return undefined; } }
    return undefined;
  })();

  const metaServices = data?.meta?.services ?? (template as any).meta?.services;
  if (Array.isArray(metaServices)) {
    metaServices.forEach((s: any) => typeof s === 'string' && names.add(s.trim()));
  }

  // fallbacks: data.services
  if (Array.isArray(data?.services)) {
    data.services.forEach((s: any) => typeof s === 'string' && names.add(s.trim()));
  }

  return Array.from(names).filter(Boolean);
}

export default function SchedulerEditor({ block, onChange, orgId, template }: Props) {
  const b = (block.content ?? {}) as SchedulerBlock;
  const effectiveOrgId = b.org_id ?? orgId;

  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Load current org services (optionally filtered by block.service_ids)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (effectiveOrgId) qs.set('org_id', effectiveOrgId);
        const svc = await fetch(`/api/scheduler/services?${qs.toString()}`).then((r) => r.json());
        const rows: ServiceOpt[] = Array.isArray(svc?.rows) ? svc.rows : [];
        setServices(rows);
        // Set default service if none picked
        if (!b.default_service_id && rows[0]?.id) {
          onChange({ default_service_id: rows[0].id });
        }
      } catch {
        // noop
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId]);

  // Import from template.meta.services → app.services
  const importFromTemplate = async () => {
    if (!effectiveOrgId) {
      toast.error('Need an org_id to import services.');
      return;
    }
    const names = extractTemplateServices(template);
    if (names.length === 0) {
      toast('No services found on this template.');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/scheduler/import-from-template', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          org_id: effectiveOrgId,
          services: names,
          default_duration_minutes: 60,
          link_all_services_to_default_resource: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Refresh services list
      const qs = new URLSearchParams();
      qs.set('org_id', effectiveOrgId);
      const svc = await fetch(`/api/scheduler/services?${qs.toString()}`).then((r) => r.json());
      const rows: ServiceOpt[] = Array.isArray(svc?.rows) ? svc.rows : [];
      setServices(rows);

      // Update block to show newly imported services by default
      if (Array.isArray(data?.service_ids) && data.service_ids.length) {
        onChange({
          service_ids: data.service_ids,
          default_service_id: data.service_ids[0],
        });
      }

      toast.success(`Imported ${data.imported_count} service${data.imported_count === 1 ? '' : 's'}.`);
    } catch (e: any) {
      toast.error(e?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Title / subtitle */}
      <Input
        label="Title"
        value={b.title || ''}
        onChange={(e: any) => onChange({ title: e.target.value })}
      />
      <Input
        label="Subtitle"
        value={b.subtitle || ''}
        onChange={(e: any) => onChange({ subtitle: e.target.value })}
      />

      {/* Services picker */}
      <div className="grid gap-2">
        <MultiSelect
          label="Services shown in this block"
          value={Array.isArray(b.service_ids) ? b.service_ids : []}
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(vals: string[]) => onChange({ service_ids: vals })}
          disabled={loading}
        />
        <Select
          label="Default Service"
          value={b.default_service_id || ''}
          onValueChange={(v: string) => onChange({ default_service_id: v || undefined })}
          disabled={loading}
        >
          <SelectItem value="">(None)</SelectItem>
          {services.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </Select>
      </div>

      {/* Import from template services */}
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <div className="font-medium">Import services from template</div>
            <div className="text-xs opacity-80">
              Reads <code>template.meta.services</code> (or <code>services_jsonb</code>) and creates
              rows in <code>app.services</code>. If no resources exist, a “Default Resource” is created and linked.
            </div>
          </div>
          <Button type="button" onClick={importFromTemplate} disabled={importing || !effectiveOrgId}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>

      {/* Toggles / timing */}
      <Switch
        checked={!!b.show_resource_picker}
        onCheckedChange={(v: boolean) => onChange({ show_resource_picker: v })}
        label="Let customers pick a specific resource"
      />

      <div className="grid grid-cols-3 gap-3">
        <Input
          type="number"
          label="Slot Granularity (min)"
          value={b.slot_granularity_minutes ?? 30}
          onChange={(e: any) => onChange({ slot_granularity_minutes: Number(e.target.value) })}
        />
        <Input
          type="number"
          label="Lead Time (min)"
          value={b.lead_time_minutes ?? 120}
          onChange={(e: any) => onChange({ lead_time_minutes: Number(e.target.value) })}
        />
        <Input
          type="number"
          label="Window (days)"
          value={b.window_days ?? 14}
          onChange={(e: any) => onChange({ window_days: Number(e.target.value) })}
        />
      </div>

      <Input
        label="Timezone (IANA)"
        value={b.timezone || 'America/Los_Angeles'}
        onChange={(e: any) => onChange({ timezone: e.target.value })}
      />

      <Input
        label="Confirmation message"
        value={b.confirmation_message || 'Thanks! Your appointment is confirmed.'}
        onChange={(e: any) => onChange({ confirmation_message: e.target.value })}
      />
    </div>
  );
}
