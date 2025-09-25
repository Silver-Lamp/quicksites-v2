// components/admin/templates/block-editors/scheduler-editor.tsx
'use client';

import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import type { BlockEditorProps } from './index';
import { SchedulerBlock } from '@/admin/lib/zod/blockSchema';

import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import toast from 'react-hot-toast';

type ServiceOpt = { id: string; name: string };

const NONE = '__none__'; // sentinel for "(None)" default service

// Same defaults as renderer so the editor shows the same values
const DEFAULTS: SchedulerBlock & { company_id?: string } = {
  title: 'Book an appointment',
  subtitle: 'Choose a time that works for you',
  org_id: undefined,
  company_id: undefined,
  service_ids: [],
  default_service_id: undefined,
  show_resource_picker: false,
  timezone: 'America/Los_Angeles',
  slot_granularity_minutes: 30,
  lead_time_minutes: 120,
  window_days: 14,
  confirmation_message: 'Thanks! Your appointment is confirmed.',
};

function extractTemplateServices(template?: any): string[] {
  if (!template) return [];
  const names = new Set<string>();

  const sj = (template as any).services_jsonb;
  if (Array.isArray(sj)) sj.forEach((s) => typeof s === 'string' && names.add(s.trim()));
  if (typeof sj === 'string') {
    try { JSON.parse(sj).forEach((s: any) => typeof s === 'string' && names.add(s.trim())); } catch {}
  }

  const sTxt = (template as any).services;
  if (typeof sTxt === 'string' && sTxt.trim()) {
    try { JSON.parse(sTxt).forEach((s: any) => typeof s === 'string' && names.add(s.trim())); } catch {}
  }

  const data = (() => {
    const d = (template as any).data;
    if (d && typeof d === 'object') return d;
    if (typeof d === 'string') { try { return JSON.parse(d); } catch { return undefined; } }
    return undefined;
  })();

  const metaServices = data?.meta?.services ?? (template as any).meta?.services;
  if (Array.isArray(metaServices)) metaServices.forEach((s: any) => typeof s === 'string' && names.add(s.trim()));
  if (Array.isArray(data?.services)) data.services.forEach((s: any) => typeof s === 'string' && names.add(s.trim()));

  return Array.from(names).filter(Boolean);
}

export default function SchedulerEditor(props: BlockEditorProps) {
  const { block, template, onSave, onClose } = props;

  // Layer defaults so editor matches the renderer
  const content = useMemo(
    () => ({ ...DEFAULTS, ...(block.content as any) }) as SchedulerBlock & { company_id?: string },
    [block.content]
  );

  // Prefer company_id; fall back to org_id for legacy installs
  const effectiveCompanyId =
    (content as any).company_id ??
    (template as any)?.company_id ??
    (template as any)?.data?.company_id ??
    undefined;

  const effectiveOrgId =
    content.org_id ??
    (template as any)?.org_id ??
    (template as any)?.data?.org_id ??
    undefined;

  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Helper: create a new Block with merged content and call onSave
  const apply = React.useCallback((patch: Partial<SchedulerBlock>) => {
    const next: Block = { ...block, content: { ...content, ...patch } };
    onSave(next); // wrapper will merge & emit template patch
  }, [block, content, onSave]);

  const appendOwnerParam = (qs: URLSearchParams) => {
    if (effectiveCompanyId) qs.set('company_id', effectiveCompanyId);
    else if (effectiveOrgId) qs.set('org_id', effectiveOrgId);
  };

  // Load services for the chosen owner
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams(); appendOwnerParam(qs);
        const svc = await fetch(`/api/scheduler/services?${qs.toString()}`).then((r) => r.json());
        const rows: ServiceOpt[] = Array.isArray(svc?.rows) ? svc.rows : [];
        setServices(rows);

        if (!content.default_service_id && rows[0]?.id) {
          apply({ default_service_id: rows[0].id });
        }
      } catch {
        // noop
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCompanyId, effectiveOrgId, block._id]);

  // Import from template → app.services
  const importFromTemplate = async () => {
    if (!effectiveCompanyId && !effectiveOrgId) {
      toast.error('Set a company (preferred) or org first to import services.');
      return;
    }
    const names = extractTemplateServices(template as Template);
    if (names.length === 0) {
      toast('No services found on this template.');
      return;
    }
    setImporting(true);
    try {
      const payload: any = {
        services: names,
        default_duration_minutes: 60,
        link_all_services_to_default_resource: true,
      };
      if (effectiveCompanyId) payload.company_id = effectiveCompanyId;
      else payload.org_id = effectiveOrgId;

      const res = await fetch('/api/scheduler/import-from-template', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // refresh service list
      const qs = new URLSearchParams(); appendOwnerParam(qs);
      const svc = await fetch(`/api/scheduler/services?${qs.toString()}`).then((r) => r.json());
      const rows: ServiceOpt[] = Array.isArray(svc?.rows) ? svc.rows : [];
      setServices(rows);

      if (Array.isArray(data?.service_ids) && data.service_ids.length) {
        apply({ service_ids: data.service_ids, default_service_id: data.service_ids[0] });
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
      {/* tiny helper since autosave is live */}
      <div className="text-xs text-muted-foreground">
        Changes save automatically.
      </div>

      <Input
        label="Title"
        value={content.title}
        onChange={(e: any) => apply({ title: e.target.value })}
      />
      <Input
        label="Subtitle"
        value={content.subtitle || ''}
        onChange={(e: any) => apply({ subtitle: e.target.value })}
      />

      {/* Services picker */}
      <div className="grid gap-2">
        <MultiSelect
          label="Services shown in this block"
          value={Array.isArray(content.service_ids) ? content.service_ids : []}
          options={services.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(vals: string[]) => apply({ service_ids: vals })}
          disabled={loading}
        />

        <Select
          label="Default Service"
          value={content.default_service_id ?? NONE}
          onValueChange={(v: string) => apply({ default_service_id: v === NONE ? undefined : v })}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="(None)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>(None)</SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
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
          <Button type="button" onClick={importFromTemplate} disabled={importing || (!effectiveCompanyId && !effectiveOrgId)}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>

      {/* Toggles / timing */}
      <Switch
        checked={!!content.show_resource_picker}
        onCheckedChange={(v: boolean) => apply({ show_resource_picker: v })}
        label="Let customers pick a specific resource"
      />

      <div className="grid grid-cols-3 gap-3">
        <Input
          type="number"
          label="Slot Granularity (min)"
          value={content.slot_granularity_minutes}
          onChange={(e: any) => apply({ slot_granularity_minutes: Number(e.target.value) })}
        />
        <Input
          type="number"
          label="Lead Time (min)"
          value={content.lead_time_minutes}
          onChange={(e: any) => apply({ lead_time_minutes: Number(e.target.value) })}
        />
        <Input
          type="number"
          label="Window (days)"
          value={content.window_days}
          onChange={(e: any) => apply({ window_days: Number(e.target.value) })}
        />
      </div>

      <Input
        label="Timezone (IANA)"
        value={content.timezone}
        onChange={(e: any) => apply({ timezone: e.target.value })}
      />

      <Input
        label="Confirmation message"
        value={content.confirmation_message}
        onChange={(e: any) => apply({ confirmation_message: e.target.value })}
      />

      {/* Sticky action bar (visible even when zoomed out) */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {/* Saves are live; offer a "Save & Close" for clarity */}
          <Button onClick={onClose}>Save & Close</Button>
        </div>
      </div>
    </div>
  );
}
