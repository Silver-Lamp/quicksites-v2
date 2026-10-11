'use client';

// components/admin/post-build-client.tsx — the form behind /admin/post-build.
import * as React from 'react';

type Item = { name: string; price: string; description: string };
type Story = { heading: string; body: string };
type Photo = { url: string; alt: string; name: string };
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']] as const;

const input = 'mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white';
const label = 'block text-xs text-zinc-500';

export default function PostBuildClient() {
  const [kind, setKind] = React.useState<'food' | 'goods' | 'services'>('food');
  const [businessName, setBusinessName] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [words, setWords] = React.useState('');
  const [headline, setHeadline] = React.useState('');
  const [subheadline, setSubheadline] = React.useState('');
  const [sectionName, setSectionName] = React.useState('For sale');
  const [items, setItems] = React.useState<Item[]>([{ name: '', price: '', description: '' }]);
  const [menuNote, setMenuNote] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [city, setCity] = React.useState('');
  const [state, setState] = React.useState('WA');
  const [phone, setPhone] = React.useState('');
  const [days, setDays] = React.useState<Record<string, { on: boolean; open: string; close: string }>>(Object.fromEntries(DAYS.map(([d]) => [d, { on: false, open: '12:00', close: '18:00' }])));
  const [story, setStory] = React.useState<Story[]>([{ heading: '', body: '' }]);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [sourceNote, setSourceNote] = React.useState('');
  const [context, setContext] = React.useState('');
  const [adult, setAdult] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [note, setNote] = React.useState('');
  const [result, setResult] = React.useState<{ previewUrl: string; platformUrl: string; claimUrl: string; dm: string; blocks: string[]; slug: string } | null>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy('photo');
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch('/api/admin/post-build/photo', { method: 'POST', body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j?.url) { setNote(`Photo ${f.name}: ${j?.error ?? res.status}`); continue; }
        setPhotos((p) => [...p, { url: j.url, alt: '', name: f.name }]);
      }
    } finally {
      setBusy(null);
    }
  }

  async function build() {
    setBusy('build');
    setNote('');
    setResult(null);
    try {
      const spec = {
        kind, businessName, firstName, words, headline, subheadline, sectionName,
        items: items.filter((i) => i.name.trim()),
        menuNote,
        where: { address, city, state, phone },
        hours: DAYS.filter(([d]) => days[d].on).map(([d]) => ({ day: d, open: days[d].open, close: days[d].close })),
        story: story.filter((s) => s.heading.trim() && s.body.trim()),
        photos: photos.map((p) => ({ url: p.url, alt: p.alt })),
        sourceNote,
        sellerIsAdult: adult,
      };
      const res = await fetch('/api/admin/post-build', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ spec, context }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) { setNote(`Could not build: ${j?.detail ?? j?.error ?? res.status}`); return; }
      setResult(j);
    } finally {
      setBusy(null);
    }
  }

  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setNote('Copied.'); } catch { setNote('Select and copy it by hand.'); } };

  return (
    <div className="mt-6 space-y-5">
      <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-2">
        <div className="text-sm sm:col-span-2">
          <span className={label}>What are they selling?</span>
          <div className="mt-1 flex gap-2">
            {([['food', 'Food — a menu, "View Menu", the order-ahead pitch'], ['goods', 'Goods — a decor or garage sale, a maker\'s table; no menu wording'], ['services', 'Services — a price list (alterations, lessons, repairs); "See prices"']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-md border px-3 py-1.5 text-left text-xs ${kind === k ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200' : 'border-zinc-700 text-zinc-400'}`}>{l}</button>
            ))}
          </div>
        </div>
        <label className="text-sm"><span className={label}>Business / page name</span><input className={input} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="River Williams Smoked Salmon" /></label>
        <label className="text-sm"><span className={label}>Their first name (for the DM)</span><input className={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="River" /></label>
        <label className="text-sm sm:col-span-2"><span className={label}>Their words — the post, as written (becomes the about text)</span><textarea className={`${input} min-h-[120px]`} value={words} onChange={(e) => setWords(e.target.value)} /></label>
        <label className="text-sm"><span className={label}>Headline (their claim, in their terms)</span><input className={input} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Bristol Bay sockeye, smoked on Vashon." /></label>
        <label className="text-sm"><span className={label}>Subheadline (when / where in one line)</span><input className={input} value={subheadline} onChange={(e) => setSubheadline(e.target.value)} placeholder="Pop-up Sunday, October 11, 12–6, across from Harbor Mercantile." /></label>
        <label className="text-sm sm:col-span-2"><span className={label}>Where the words came from (kept on the record)</span><input className={input} value={sourceNote} onChange={(e) => setSourceNote(e.target.value)} placeholder="Public post in the Vashon All Facebook group, 2026-10-10" /></label>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-end gap-3">
          <label className="flex-1 text-sm"><span className={label}>Section title</span><input className={input} value={sectionName} onChange={(e) => setSectionName(e.target.value)} /></label>
          <label className="flex-1 text-sm"><span className={label}>Note under the prices (optional)</span><input className={input} value={menuNote} onChange={(e) => setMenuNote(e.target.value)} placeholder="Portions are weighed at the stand." /></label>
        </div>
        <div className="mt-3 space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_2fr_auto]">
              <input className={input} placeholder="Item" value={it.name} onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input className={input} placeholder="$3 per oz" value={it.price} onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <input className={input} placeholder="Description, in their words (optional)" value={it.description} onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <button type="button" onClick={() => setItems((p) => p.filter((_, j) => j !== i))} className="mt-1 rounded-md border border-zinc-700 px-2 text-xs text-zinc-400">×</button>
            </div>
          ))}
          <button type="button" onClick={() => setItems((p) => [...p, { name: '', price: '', description: '' }])} className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300">+ item</button>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 sm:grid-cols-3">
        <label className="text-sm"><span className={label}>Where (as they put it)</span><input className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Across from Harbor Mercantile" /></label>
        <label className="text-sm"><span className={label}>City</span><input className={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Vashon" /></label>
        <label className="text-sm"><span className={label}>State</span><input className={input} value={state} onChange={(e) => setState(e.target.value)} maxLength={2} /></label>
        <label className="text-sm sm:col-span-3"><span className={label}>Phone — only if the post itself published it (the hero button dials it)</span><input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="206-463-3782" /></label>
        <div className="sm:col-span-3">
          <span className={label}>When (days they are open; everything else shows closed)</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {DAYS.map(([d, l]) => (
              <label key={d} className="flex items-center gap-1 text-xs text-zinc-300">
                <input type="checkbox" checked={days[d].on} onChange={(e) => setDays((p) => ({ ...p, [d]: { ...p[d], on: e.target.checked } }))} />
                {l}
                {days[d].on && (
                  <>
                    <input type="time" value={days[d].open} onChange={(e) => setDays((p) => ({ ...p, [d]: { ...p[d], open: e.target.value } }))} className="rounded border border-zinc-700 bg-zinc-950 px-1 text-xs text-white" />
                    –
                    <input type="time" value={days[d].close} onChange={(e) => setDays((p) => ({ ...p, [d]: { ...p[d], close: e.target.value } }))} className="rounded border border-zinc-700 bg-zinc-950 px-1 text-xs text-white" />
                  </>
                )}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <span className={label}>Story panels — their replies in the thread, if any (optional)</span>
        <div className="mt-2 space-y-2">
          {story.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
              <input className={input} placeholder="Heading" value={s.heading} onChange={(e) => setStory((p) => p.map((x, j) => (j === i ? { ...x, heading: e.target.value } : x)))} />
              <input className={input} placeholder="What they said" value={s.body} onChange={(e) => setStory((p) => p.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" onClick={() => setStory((p) => [...p, { heading: '', body: '' }])} className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300">+ panel</button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <span className={label}>Their photos — the first becomes the hero. Crop the post's chrome off before uploading.</span>
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => void upload(e.target.files)} className="mt-2 block text-xs text-zinc-400" />
        {photos.length > 0 && (
          <ul className="mt-2 grid gap-2 sm:grid-cols-4">
            {photos.map((p, i) => (
              <li key={p.url} className="text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="h-24 w-full rounded object-cover" />
                <input className={`${input} mt-1`} placeholder="alt text" value={p.alt} onChange={(e) => setPhotos((q) => q.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                <button type="button" onClick={() => setPhotos((q) => q.filter((_, j) => j !== i))} className="mt-1 text-zinc-500 hover:text-zinc-300">remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-4">
        <label className="flex items-start gap-2 text-sm text-zinc-200">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1" />
          <span>This person is an adult, and everything above is their own words, photos and prices. (A child's stand is the lemonade vertical with the parent — never a page in a minor's name or voice.)</span>
        </label>
        <label className="mt-3 block text-sm"><span className={label}>One line of context for the DM (optional — e.g. "I lived on the island a while and saw your post in Vashon All.")</span><input className={input} value={context} onChange={(e) => setContext(e.target.value)} /></label>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={busy !== null || !adult || !businessName.trim() || !words.trim() || !headline.trim()} onClick={build} className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-50">
            {busy === 'build' ? 'Building…' : 'Build their site'}
          </button>
          {note && <span className="text-xs text-zinc-400">{note}</span>}
        </div>
      </div>

      {result && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-4 text-sm">
          <p className="text-zinc-200">Built <span className="font-mono">{result.slug}</span> — blocks: {result.blocks.join(', ')}.</p>
          <p className="mt-2"><span className="text-zinc-500">Share with everyone:</span> <a href={result.previewUrl} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline">{result.previewUrl}</a></p>
          <p className="mt-1"><span className="text-zinc-500">For them only (the claim link — never post it):</span> <button type="button" onClick={() => copy(result.claimUrl)} className="text-emerald-300 hover:underline">copy claim link</button></p>
          <div className="mt-3">
            <div className="flex items-center justify-between"><span className="text-zinc-500">DM draft</span><button type="button" onClick={() => copy(result.dm)} className="text-xs text-emerald-300 hover:underline">copy</button></div>
            <pre className="mt-1 whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">{result.dm}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
