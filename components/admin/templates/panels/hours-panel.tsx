'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Template } from '@/types/template';
import type { HoursOfOperationContent } from '@/admin/lib/zod/blockSchema';
import { defaultHoursContent } from '@/admin/lib/zod/blockSchema';
import { HoursOfOperationEditor } from '@/components/admin/templates/block-editors/hours-editor';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

import { Clock, Copy, Globe2, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  isOpenNow,
  formatTodayText,
  matchExceptionForYMD,
  partsInTz,
} from '@/lib/hours/utils';

type Props = {
  template: Template;
  onChange: (patch: Partial<Template>) => void;
  className?: string;

  /** Provided by the sidebar so it can scrollIntoView(this panel) */
  panelRef?: React.RefObject<HTMLDivElement> | null;
  /** If true, force-open the inline editor */
  forceOpenEditor?: boolean;
  /** If true, show a quick spotlight ring */
  spotlight?: boolean;
};

function coalesceHours(t: Template): HoursOfOperationContent {
  const meta = (t.data as any)?.meta ?? {};
  const m = meta?.hours as HoursOfOperationContent | undefined;
  const top = (t as any).hours as HoursOfOperationContent | undefined;
  return (m ?? top ?? defaultHoursContent());
}

export default function HoursPanel({
  template,
  onChange,
  className,
  panelRef,
  forceOpenEditor,
  spotlight,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const [sectionOpen, setSectionOpen] = useState<boolean>(false);
  const [inlineOpen, setInlineOpen] = useState(false);

  // local spotlight state (so we can trigger from events)
  const [spotlightLocal, setSpotlightLocal] = useState(false);
  const showSpotlight = !!spotlight || spotlightLocal;

  // give the sidebar a live ref to this panel container
  useEffect(() => {
    if (panelRef && 'current' in panelRef) {
      (panelRef as any).current = containerRef.current;
    }
  }, [panelRef]);

  // If the caller forces the editor open, open the section too
  useEffect(() => {
    if (forceOpenEditor) {
      setSectionOpen(true);
      setInlineOpen(true);
    }
  }, [forceOpenEditor]);

  // canonical site-wide hours
  const hours: HoursOfOperationContent = useMemo(
    () => coalesceHours(template),
    [template]
  );

  // Utility to patch meta.hours + mirror top- level hours (for back-compat)
  const setHours = (next: HoursOfOperationContent) => {
    onChange({
      hours: next, // tiny mirror
      data: {
        ...(template.data as any),
        meta: { ...((template.data as any)?.meta ?? {}), hours: next },
      },
    });
  };

  // Quick toggles
  const toggle247 = (on: boolean) => {
    const next = { ...hours, alwaysOpen: on };
    setHours(next);
  };
  const setDisplayStyle = (style: 'table' | 'stack') => {
    if (hours.display_style === style) return;
    setHours({ ...hours, display_style: style });
  };
  const useBrowserTz = () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    if (tz && tz !== hours.tz) setHours({ ...hours, tz });
    toast.success(`Timezone set to ${tz}`);
  };

  const title = hours.title ?? 'Business Hours';
  const tz = hours.tz ?? '—';

  // Read-only "Today" preview (shared logic with renderer)
  const preview = useMemo(() => {
    const openNow = isOpenNow(hours);
    const { text, hasCarry } = formatTodayText(hours);
    const nowParts = partsInTz(new Date(), hours.tz);
    const exToday = matchExceptionForYMD(hours.exceptions, nowParts.ymd);
    return { openNow, text, hasCarry, exTodayLabel: exToday?.label ?? '' };
  }, [hours]);

  // Copy helpers
  const copyToday = () => {
    const t = `Today: ${preview.text}${preview.openNow ? ' (Open now)' : ' (Closed now)'}`;
    navigator.clipboard?.writeText(t)
      .then(() => toast.success('Copied today’s hours'))
      .catch(() => toast.error('Copy failed'));
  };
  const copyWeek = () => {
    try {
      const lines = [
        `${title}${hours.tz ? ` (${hours.tz})` : ''}`,
        ...hours.days.map((d) => {
          const open = d.periods[0]?.open?.trim() ?? '';
          const close = d.periods[0]?.close?.trim() ?? '';
          const label = d.label ?? d.key;
          return open && close ? `${label}: ${open}–${close}` : `${label}: Closed`;
        }),
      ];
      navigator.clipboard?.writeText(lines.join('\n'))
        .then(() => toast.success('Copied weekly hours'))
        .catch(() => toast.error('Copy failed'));
    } catch {
      toast.error('Copy failed');
    }
  };

  /* ─────────────────────── Event wiring (open from HoursEditorRedirect) ─────────────────────── */

  useEffect(() => {
    const handler = (e: Event) => {
      const d: any = (e as CustomEvent).detail || {};
      const target = d.panelId ?? d.panel ?? d.id ?? d.slug;
      if (target !== 'hours') return;

      // open the section + inline editor
      setSectionOpen(true);
      if (d.openEditor !== false) setInlineOpen(true);

      // scroll & spotlight
      if (d.scroll !== false) {
        const node = containerRef.current ?? document.querySelector('[data-panel-id="hours"]');
        if (node && 'scrollIntoView' in node) {
          (node as HTMLElement).scrollIntoView({ behavior: d.behavior ?? 'smooth', block: 'center' });
        }
      }
      if (typeof d.spotlightMs === 'number' && d.spotlightMs > 0) {
        setSpotlightLocal(true);
        setTimeout(() => setSpotlightLocal(false), d.spotlightMs);
      }

      // let the opener know we handled it
      try {
        window.dispatchEvent(new CustomEvent('qs:panel-opened', { detail: { panel: 'hours' } }));
      } catch {}
    };

    window.addEventListener('qs:open-settings-panel', handler as any);
    window.addEventListener('qs:open-panel', handler as any);
    window.addEventListener('qs:settings:open-panel', handler as any);
    window.addEventListener('qs:panel:open', handler as any);

    return () => {
      window.removeEventListener('qs:open-settings-panel', handler as any);
      window.removeEventListener('qs:open-panel', handler as any);
      window.removeEventListener('qs:settings:open-panel', handler as any);
      window.removeEventListener('qs:panel:open', handler as any);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-panel-id="hours"
      className={`${className ?? ''} ${showSpotlight ? 'ring-2 ring-violet-500/70 rounded-xl' : ''}`}
    >
      <details
        ref={detailsRef}
        open={sectionOpen}
        onToggle={(e) => setSectionOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="group rounded-xl border bg-background/60"
      >
        {/* Header / Summary */}
        <summary
          className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 select-none"
          role="button"
          aria-expanded={sectionOpen}
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border">
            {sectionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
          <Clock className="w-4 h-4 opacity-80" />
          <span className="font-medium">Hours of Operation</span>
          <span className="ml-auto text-xs opacity-70">
            {title} · {tz}
          </span>
        </summary>

        {/* Content */}
        <div className="space-y-3 border-t p-3">
          {/* Guidance */}
          <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-xs text-white/70 leading-relaxed">
            <ul className="list-disc list-inside space-y-1">
              <li>These hours are <strong>site-wide</strong> and live in <code>data.meta.hours</code>.</li>
              <li>Supports <em>exceptions</em> (holidays) and overnight carry (e.g., 8pm–2am).</li>
              <li>Blocks and the footer/contact areas read from these values automatically.</li>
            </ul>
          </div>

          {/* Today preview row */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="opacity-70">Today:</span>
            <span className="tabular-nums">{preview.text}</span>
            {preview.hasCarry && (
              <span className="text-xs inline-flex items-center rounded-full border px-2 py-0.5">
                includes overnight carry
              </span>
            )}
            {preview.exTodayLabel && (
              <span className="text-xs inline-flex items-center rounded-full border px-2 py-0.5">
                special hours: {preview.exTodayLabel}
              </span>
            )}
            <Badge
              variant="outline"
              className={
                preview.openNow
                  ? 'border-green-500 text-green-600'
                  : 'border-rose-400 text-rose-500'
              }
            >
              {preview.openNow ? 'Open now' : 'Closed now'}
            </Badge>

            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="icon" onClick={copyToday} title="Copy today’s hours">
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={copyWeek} title="Copy weekly hours">
                Copy week
              </Button>
            </div>
          </div>

          {/* Quick toggles */}
          <div className="flex items-center gap-3">
            <Switch id="hours-247" checked={!!hours.alwaysOpen} onCheckedChange={toggle247} />
            <Label htmlFor="hours-247">Open 24/7</Label>

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={useBrowserTz} className="gap-1">
                <Globe2 className="h-4 w-4" />
                Use my timezone
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm opacity-75">
              Display:{' '}
              <span className="font-medium">
                {hours.display_style === 'stack' ? 'Stack' : 'Table'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={hours.display_style === 'table' ? 'default' : 'secondary'}
                onClick={() => setDisplayStyle('table')}
              >
                Table
              </Button>
              <Button
                size="sm"
                variant={hours.display_style === 'stack' ? 'default' : 'secondary'}
                onClick={() => setDisplayStyle('stack')}
              >
                Stack
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setInlineOpen((s) => !s)}
                data-action="open-hours-editor"
              >
                {inlineOpen ? 'Close Editor' : 'Edit Hours'}
              </Button>
            </div>
          </div>

          {/* Inline editor (reuses block editor UI) */}
          {inlineOpen && (
            <div className="mt-2 rounded-lg border bg-muted/40 p-2">
              <HoursOfOperationEditor
                block={{
                  id: 'hours-settings-adapter',
                  // // @ts-expect-error adapter shape to reuse editor
                  type: 'hours',
                  content: hours,
                }}
                onSave={(updated: any) => {
                  setHours(updated.content as HoursOfOperationContent);
                }}
                onClose={() => setInlineOpen(false)}
                // // @ts-expect-error depends on your local BlockEditorProps definition
                template={template}
              />
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
