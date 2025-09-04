// lib/timeline.ts
export type TimelineEntry = {
    id?: string;          // if you have a stable id from DB/event, great
    kind: 'save' | 'publish' | 'snapshot' | string;
    rev?: number | null;
    at?: string | number; // ISO or epoch
    // ...anything else (deltas, user, etc)
    [k: string]: any;
  };
  
  function keyOf(e: TimelineEntry) {
    // a stable signature that ignores time so identical events collapse
    const { at, time, timestamp, ...rest } = e ?? {};
    if (e?.id) return `id:${e.id}`;
    return `${rest.kind ?? 'event'}:${rest.rev ?? ''}:${JSON.stringify(rest)}`;
  }
  
  export function dedupeTimeline(list: TimelineEntry[]): TimelineEntry[] {
    const seen = new Set<string>();
    const out: TimelineEntry[] = [];
    for (const e of list) {
      const k = keyOf(e);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out;
  }
  
  /** Wrap a state setter so identical events within N ms are ignored */
  export function withSoftThrottle<T extends TimelineEntry>(
    push: (e: T | T[]) => void,
    windowMs = 3000
  ) {
    let lastKey = '';
    let lastAt = 0;
    return (e: T | T[]) => {
      const arr = Array.isArray(e) ? e : [e];
      const filtered: T[] = [];
      const now = Date.now();
      for (const item of arr) {
        const k = keyOf(item);
        if (k === lastKey && now - lastAt < windowMs) continue;
        lastKey = k;
        lastAt = now;
        filtered.push(item);
      }
      if (filtered.length) push(Array.isArray(e) ? filtered : filtered[0]);
    };
  }
  