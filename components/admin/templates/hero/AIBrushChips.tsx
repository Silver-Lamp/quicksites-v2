'use client';
import React, { useEffect, useState } from 'react';


type Field = 'headline' | 'subheadline' | 'cta_text';


export type AIBrushChipsProps = {
field: Field;
templateId?: string;
industry?: string;
city?: string;
state?: string;
current?: string;
onApply: (value: string) => void;
onClose?: () => void;
};


function shorten(s: string, max: number) { return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'; }


export default function AIBrushChips({ field, templateId, industry, city, state, current = '', onApply, onClose }: AIBrushChipsProps) {
const [busy, setBusy] = useState(false);
const [err, setErr] = useState<string | null>(null);
const [cands, setCands] = useState<string[]>([]);


async function fetchOnce() {
setBusy(true); setErr(null);
try {
const res = await fetch('/api/hero/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ template_id: templateId, industry, city, state }) });
if (!res.ok) throw new Error('Suggest failed');
const data = await res.json() as Partial<Record<Field, string>>;
const base = data[field] || current || '';
const chips = new Set<string>();
if (base) chips.add(base);
// simple variants
if (field !== 'cta_text') chips.add(shorten(base.replace(/[.!?]+$/,'').trim(), 56));
if (city || state) chips.add(`${base.replace(/[.!?]+$/,'').trim()} in ${city || ''}${city && state ? ', ' : ''}${state || ''}`.trim());
if (field === 'cta_text') chips.add('Get Started Today');
setCands(Array.from(chips).filter(Boolean).slice(0, 4));
} catch (e: any) { setErr(e.message || 'Failed'); }
finally { setBusy(false); }
}


useEffect(() => { fetchOnce(); /* eslint-disable-next-line */ }, [field, templateId, industry, city, state]);


return (
<div className="mt-3 flex flex-wrap items-center gap-2">
{cands.map((t, i) => (
<button key={i} onClick={() => onApply(t)} className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white border border-white/20 hover:bg-white/15">
{t}
</button>
))}
<button onClick={fetchOnce} className="px-2.5 py-1 rounded-full text-xs bg-white text-gray-900 border border-white/10">Shuffle ✨</button>
{onClose && (
<button onClick={onClose} className="ml-auto px-2.5 py-1 rounded-full text-xs bg-white/10 text-white border border-white/20">Close</button>
)}
{busy && <span className="text-[11px] text-white/70">Generating…</span>}
{err && <span className="text-[11px] text-rose-400">{err}</span>}
</div>
);
}