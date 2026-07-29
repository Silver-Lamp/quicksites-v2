'use client';

// app/admin/menu-run/menu-run-client.tsx
//
// The Saturday tool. Designed to be used ONE-HANDED, ON A PAVEMENT, IN SUNLIGHT — which drives
// every layout choice here: big tap targets, one stop expanded at a time, status visible
// without scrolling, and no modal that needs a precise dismiss.
//
// The camera input uses capture="environment", so on a phone it opens the rear camera directly
// instead of a file picker.
import * as React from 'react';

type Stop = {
  prospectId: string;
  templateId: string;
  slug: string;
  businessName: string;
  address: string | null;
  phone: string | null;
  siteUrl: string;
  done: boolean;
};

type Result =
  | { state: 'idle' }
  | { state: 'reading' }
  | { state: 'ok'; items: number; preview: { name: string; items: string[] }[] }
  | { state: 'error'; message: string };

/** Downscale before upload: a 12MP phone photo is ~5MB and the vision model reads 1600px fine. */
async function fileToDataUrl(file: File, maxEdge = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function MenuRunClient({
  campaignId,
  city,
}: {
  campaignId: string;
  city: string;
}) {
  const [stops, setStops] = React.useState<Stop[] | null>(null);
  const [open, setOpen] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<Record<string, Result>>({});
  const [locating, setLocating] = React.useState(false);

  const load = React.useCallback(async (start?: GeolocationCoordinates) => {
    const qs = new URLSearchParams({ campaign: campaignId });
    if (start) {
      qs.set('lat', String(start.latitude));
      qs.set('lng', String(start.longitude));
    }
    const res = await fetch(`/api/admin/menu-run?${qs}`, { cache: 'no-store' });
    const j = await res.json();
    setStops(j.stops ?? []);
  }, [campaignId]);

  React.useEffect(() => { void load(); }, [load]);

  /** Order the run from where the operator is standing. Optional — the list works without it. */
  const orderFromHere = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { void load(pos.coords).finally(() => setLocating(false)); },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const capture = async (stop: Stop, files: FileList | null) => {
    if (!files?.length) return;
    setResults((r) => ({ ...r, [stop.templateId]: { state: 'reading' } }));
    try {
      const images = await Promise.all(Array.from(files).slice(0, 4).map((f) => fileToDataUrl(f)));
      const res = await fetch('/api/admin/menu-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: stop.templateId, images }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setResults((r) => ({
          ...r,
          [stop.templateId]: { state: 'error', message: j.message || j.error || 'Failed to read the menu.' },
        }));
        return;
      }
      setResults((r) => ({ ...r, [stop.templateId]: { state: 'ok', items: j.items, preview: j.preview ?? [] } }));
      setStops((s) => (s ?? []).map((x) => (x.templateId === stop.templateId ? { ...x, done: true } : x)));
    } catch (e: any) {
      setResults((r) => ({ ...r, [stop.templateId]: { state: 'error', message: e?.message || 'Upload failed.' } }));
    }
  };

  if (!stops) return <p className="p-6 text-muted-foreground">Loading the run…</p>;

  const remaining = stops.filter((s) => !s.done).length;

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Menu run — {city}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick up a paper menu, photograph it, leave a postcard. The menu goes live on their site
        within a minute, so the postcard&rsquo;s promise is true before you&rsquo;re back in the car.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-full border border-border bg-card px-3 py-1 text-sm">
          {remaining} of {stops.length} left
        </span>
        <button
          onClick={orderFromHere}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          {locating ? 'Locating…' : '📍 Order from here'}
        </button>
        {/* The postcards already exist — reuse the campaign poster surface rather than
            building a second print path that would drift from it. Print before you leave. */}
        <a
          href={`/admin/prospects/poster/${campaignId}`}
          target="_blank"
          rel="noopener"
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          🖨 Postcards
        </a>
      </div>

      <ol className="mt-6 space-y-3">
        {stops.map((s, i) => {
          const r = results[s.templateId] ?? { state: 'idle' as const };
          const expanded = open === s.templateId;
          return (
            <li key={s.templateId} className="rounded-xl border border-border bg-card">
              <button
                onClick={() => setOpen(expanded ? null : s.templateId)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    s.done
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s.done ? '✓' : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-card-foreground">{s.businessName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {s.address || 'No address on file'}
                  </span>
                </span>
              </button>

              {expanded && (
                <div className="space-y-3 border-t border-border p-4">
                  <div className="flex flex-wrap gap-2">
                    {s.address && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`}
                        target="_blank"
                        rel="noopener"
                        className="rounded-lg border border-border px-3 py-2 text-sm font-medium"
                      >
                        🧭 Directions
                      </a>
                    )}
                    {s.phone && (
                      <a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`} className="rounded-lg border border-border px-3 py-2 text-sm font-medium">
                        📞 {s.phone}
                      </a>
                    )}
                    <a href={s.siteUrl} target="_blank" rel="noopener" className="rounded-lg border border-border px-3 py-2 text-sm font-medium">
                      🔗 Their page
                    </a>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium">
                      {s.done ? 'Replace the menu' : 'Photograph the menu'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={(e) => capture(s, e.target.files)}
                      className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-primary-foreground"
                    />
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Whole menu in frame, good light. Several photos are fine for a long menu.
                    </span>
                  </label>

                  {r.state === 'reading' && (
                    <p className="text-sm text-muted-foreground">Reading the menu… (~20s)</p>
                  )}
                  {r.state === 'error' && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                      {r.message}
                    </p>
                  )}
                  {r.state === 'ok' && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                      <p className="font-medium text-foreground">✓ {r.items} items live on their site</p>
                      {r.preview.map((sec) => (
                        <p key={sec.name} className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium">{sec.name}:</span> {sec.items.join(', ')}
                        </p>
                      ))}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Check it looks right before you leave the postcard &mdash; you&rsquo;re the
                        last human between the photo and their customers.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
