'use client';

import { useMemo, useState } from 'react';
import type { Block } from '@/types/blocks';
import {
  type DayKey, type HoursOfOperationContent, type HoursPeriod, type SpecialHours, defaultHoursContent,
} from '@/admin/lib/zod/blockSchema';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Copy, Plus, Trash2, CalendarDays, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

const ORDER: DayKey[] = ['mon','tue','wed','thu','fri','sat','sun'];

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }
function rid() { return crypto.randomUUID(); }

export function HoursOfOperationEditor({ block, onSave, onClose }: BlockEditorProps) {
  const initial = useMemo<HoursOfOperationContent>(() => {
    return defaultHoursContent(block?.content as HoursOfOperationContent | undefined);
  }, [block]);

  const [content, setContent] = useState<HoursOfOperationContent>(initial);

  // ---------- Days helpers ----------
  const setDay = (key: DayKey, patch: Partial<HoursOfOperationContent['days'][number]>) => {
    setContent((prev) => {
      const next = clone(prev);
      const i = next.days.findIndex(d => d.key === key);
      if (i >= 0) next.days[i] = { ...next.days[i], ...patch };
      return next;
    });
  };

  const addPeriod = (key: DayKey) => {
    setContent(prev => {
      const next = clone(prev);
      const d = next.days.find(x => x.key === key)!;
      d.closed = false;
      d.periods.push({ open: '09:00', close: '17:00' });
      return next;
    });
  };

  const updatePeriod = (key: DayKey, idx: number, patch: Partial<HoursPeriod>) => {
    setContent(prev => {
      const next = clone(prev);
      const d = next.days.find(x => x.key === key)!;
      d.periods[idx] = { ...d.periods[idx], ...patch };
      return next;
    });
  };

  const removePeriod = (key: DayKey, idx: number) => {
    setContent(prev => {
      const next = clone(prev);
      const d = next.days.find(x => x.key === key)!;
      d.periods.splice(idx, 1);
      if (d.periods.length === 0) d.closed = true;
      return next;
    });
  };

  const copyPrevious = (key: DayKey) => {
    setContent(prev => {
      const next = clone(prev);
      const i = next.days.findIndex(d => d.key === key);
      if (i > 0) {
        next.days[i].closed = next.days[i-1].closed;
        next.days[i].periods = clone(next.days[i-1].periods);
      }
      return next;
    });
  };

  const setAll247 = (on: boolean) => {
    setContent(prev => {
      const next = clone(prev);
      next.alwaysOpen = on;
      if (on) {
        next.days.forEach(d => { d.closed = false; d.periods = [{ open: '00:00', close: '23:59' }]; });
      }
      return next;
    });
  };

  // ---------- Exceptions helpers ----------
  const addException = () => {
    setContent(prev => {
      const next = clone(prev);
      next.exceptions = next.exceptions ?? [];
      next.exceptions.push({
        id: rid(),
        label: '',
        date: new Date().toISOString().slice(0,10), // today by default
        recurring: true,
        closed: true,
        periods: [],
      });
      return next;
    });
  };

  const updateException = (id: string, patch: Partial<SpecialHours>) => {
    setContent(prev => {
      const next = clone(prev);
      next.exceptions = (next.exceptions ?? []).map(ex => ex.id === id ? { ...ex, ...patch } : ex);
      // if closed -> wipe periods
      const ex = next.exceptions.find(e => e.id === id);
      if (ex && ex.closed) ex.periods = [];
      return next;
    });
  };

  const removeException = (id: string) => {
    setContent(prev => {
      const next = clone(prev);
      next.exceptions = (next.exceptions ?? []).filter(ex => ex.id !== id);
      return next;
    });
  };

  const addExceptionPeriod = (id: string) => {
    setContent(prev => {
      const next = clone(prev);
      const ex = (next.exceptions ?? []).find(e => e.id === id);
      if (ex) {
        ex.closed = false;
        ex.periods.push({ open: '10:00', close: '14:00' });
      }
      return next;
    });
  };

  const updateExceptionPeriod = (id: string, idx: number, patch: Partial<HoursPeriod>) => {
    setContent(prev => {
      const next = clone(prev);
      const ex = (next.exceptions ?? []).find(e => e.id === id);
      if (ex) ex.periods[idx] = { ...ex.periods[idx], ...patch };
      return next;
    });
  };

  const removeExceptionPeriod = (id: string, idx: number) => {
    setContent(prev => {
      const next = clone(prev);
      const ex = (next.exceptions ?? []).find(e => e.id === id);
      if (ex) {
        ex.periods.splice(idx, 1);
        if (ex.periods.length === 0) ex.closed = true;
      }
      return next;
    });
  };

  // ---------- Save ----------
  const save = () => {
    const updated: Block = {
      ...(block as Block),
      type: 'hours',
      content,
    };
    onSave(updated);
    onClose?.();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Clock className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Hours of Operation</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="hours-title">Title</Label>
          <Input id="hours-title" value={content.title ?? ''} placeholder="Business Hours"
                 onChange={(e) => setContent({ ...content, title: e.target.value })}/>
        </div>
        <div>
          <Label htmlFor="hours-tz">Timezone (IANA)</Label>
          <Input id="hours-tz" value={content.tz ?? ''} placeholder="America/Los_Angeles"
                 onChange={(e) => setContent({ ...content, tz: e.target.value })}/>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="always-open" checked={!!content.alwaysOpen} onCheckedChange={setAll247}/>
          <Label htmlFor="always-open">Open 24/7</Label>
        </div>
        <div>
          <Label htmlFor="hours-note">Note (optional)</Label>
          <Textarea id="hours-note" value={content.note ?? ''} placeholder="Closed on federal holidays"
                    onChange={(e) => setContent({ ...content, note: e.target.value })}/>
        </div>
      </div>

      {/* Regular weekly hours */}
      <div className="rounded-2xl border p-4">
        <div className="grid grid-cols-[80px_1fr] gap-4">
          {ORDER.map((key) => {
            const day = content.days.find(d => d.key === key)!;
            return (
              <div key={key} className="contents">
                <div className="pt-2 font-medium">{day.label}</div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`closed-${key}`}
                      checked={!day.closed}
                      onCheckedChange={(on) => setDay(key, { closed: !on })}
                    />
                    <Label htmlFor={`closed-${key}`}>{day.closed ? 'Closed' : 'Open'}</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => copyPrevious(key)} title="Copy previous day">
                      <Copy className="w-4 h-4 mr-1" /> Copy prev
                    </Button>
                  </div>

                  {!day.closed && (
                    <div className="space-y-2">
                      {day.periods.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input type="time" value={p.open} className="w-36"
                                 onChange={(e) => updatePeriod(key, idx, { open: e.target.value })}/>
                          <span className="opacity-70">to</span>
                          <Input type="time" value={p.close} className="w-36"
                                 onChange={(e) => updatePeriod(key, idx, { close: e.target.value })}/>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePeriod(key, idx)} title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}

                      <Button type="button" variant="secondary" size="sm" onClick={() => addPeriod(key)}>
                        <Plus className="w-4 h-4 mr-1" /> Add time range
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs opacity-60">
          Overnight supported: set a range where close is earlier than open (e.g., 22:00 → 02:00).
        </p>
      </div>

      {/* Exceptions */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          <h4 className="font-semibold">Holiday & Special Hours</h4>
          <Badge variant="outline" className="ml-2">{content.exceptions?.length ?? 0}</Badge>
        </div>
        <p className="text-xs opacity-60">
         Exceptions override regular hours (and 24/7) for that date. Overnight spans are supported.
        </p>
        <div className="space-y-3">
          {(content.exceptions ?? []).map((ex) => (
            <Card key={ex.id} className="border rounded-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3 md:items-end">
                  <div className="flex-1">
                    <Label>Label</Label>
                    <Input
                      placeholder="Christmas Day"
                      value={ex.label ?? ''}
                      onChange={(e) => updateException(ex.id, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={ex.date}
                      onChange={(e) => updateException(ex.id, { date: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`recurring-${ex.id}`}
                      checked={!!ex.recurring}
                      onCheckedChange={(on) => updateException(ex.id, { recurring: on })}
                    />
                    <Label htmlFor={`recurring-${ex.id}`}>Repeats every year</Label>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => removeException(ex.id)} title="Remove">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    id={`exclosed-${ex.id}`}
                    checked={!ex.closed}
                    onCheckedChange={(on) => updateException(ex.id, { closed: !on })}
                  />
                  <Label htmlFor={`exclosed-${ex.id}`}>{ex.closed ? 'Closed this date' : 'Open with special hours'}</Label>
                </div>

                {!ex.closed && (
                  <div className="space-y-2">
                    {ex.periods.map((p, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input type="time" value={p.open} className="w-36"
                               onChange={(e) => updateExceptionPeriod(ex.id, idx, { open: e.target.value })}/>
                        <span className="opacity-70">to</span>
                        <Input type="time" value={p.close} className="w-36"
                               onChange={(e) => updateExceptionPeriod(ex.id, idx, { close: e.target.value })}/>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeExceptionPeriod(ex.id, idx)} title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="secondary" size="sm" onClick={() => addExceptionPeriod(ex.id)}>
                      <Plus className="w-4 h-4 mr-1" /> Add time range
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button type="button" onClick={addException}>
          <Plus className="w-4 h-4 mr-1" /> Add holiday / special date
        </Button>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Badge variant="outline" className={clsx('mr-auto', content.display_style === 'stack' && 'bg-muted')}>
          Style: {content.display_style ?? 'table'}
        </Badge>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>
          <RefreshCw className="w-4 h-4 mr-1" /> Save Hours
        </Button>
      </div>
    </div>
  );
}
