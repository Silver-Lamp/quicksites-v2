'use client';

import { useEffect, useState } from 'react';
import TagInput from '@/components/ui/tag-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COMMON_CUISINES } from '@/lib/cuisines';
import { slugify } from '@/lib/slug';
import ShareModal from '@/components/admin/chef/share-modal';

type Meal = {
  id: string;
  title: string;
  price_cents: number;
  is_active: boolean;
  qty_available: number | null;
  max_per_order: number | null;
  cuisines?: string[] | null;
  created_at: string;
  site_id: string;
};

export default function MealsTableEditable({ siteId, reloadKey = 0 }: { siteId: string; reloadKey?: number }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({});
  const [cuisineOpts, setCuisineOpts] = useState<string[]>(COMMON_CUISINES);
  const [saving, setSaving] = useState(false);
  const [shareMeal, setShareMeal] = useState<null | { id:string; slug?:string|null; title:string; price_cents:number; cuisines?:string[]|null }>(null);
  
  useEffect(() => { load(); }, [siteId, reloadKey]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/chef/meals/list?siteId=${encodeURIComponent(siteId)}`);
      const data = await r.json();
      setMeals(data?.meals ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const p = new URLSearchParams({ siteId });
        const r = await fetch(`/api/public/cuisines?${p.toString()}`);
        const data = await r.json();
        const arr = Array.isArray(data?.cuisines) && data.cuisines.length ? data.cuisines : COMMON_CUISINES;
        setCuisineOpts(arr);
      } catch {
        setCuisineOpts(COMMON_CUISINES);
      }
    })();
  }, [siteId]);

  useEffect(() => {
    if (!editingId || !form.slug || !form.slug.trim()) return;
    let canceled = false;
    const t = setTimeout(async () => {
      try {
        setForm((f:any) => ({ ...f, slugStatus: { ...f.slugStatus, state: 'checking' } }));
        const params = new URLSearchParams({ siteId, slug: form.slug, excludeMealId: editingId });
        const r = await fetch(`/api/chef/meals/slug-check?${params.toString()}`);
        const d = await r.json();
        if (canceled) return;
        setForm((f:any) => ({
          ...f,
          slugStatus: { state: d.available ? 'ok' : 'taken', normalized: d.normalized, suggestion: d.suggestion }
        }));
      } catch {
        if (!canceled) setForm((f:any) => ({ ...f, slugStatus: { state: 'err' } }));
      }
    }, 300);
    return () => { clearTimeout(t); canceled = true; };
  }, [form.slug, editingId, siteId]);
  
  function beginEdit(m: Meal) {
    setEditingId(m.id);
    setForm({
      title: m.title,
      price_cents: m.price_cents,
      qty_available: m.qty_available ?? 0,
      max_per_order: m.max_per_order ?? 1,
      cuisines: m.cuisines ?? [],
      is_active: m.is_active,
      auto_deactivate_when_sold_out: (m as any).auto_deactivate_when_sold_out ?? true,
      slug: (m as any).slug || '',
      slugStatus: { state: 'idle' as const, normalized: undefined, suggestion: undefined }
    });
  }
  function cancelEdit() { setEditingId(null); setForm({}); }

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      let payload = { ...form };
      if (form.slugStatus?.state === 'taken' && form.slugStatus?.suggestion) {
        payload.slug = form.slugStatus.suggestion;  // auto-upgrade
      }
      const r = await fetch('/api/chef/meals/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealId: id, hashtags: form.hashtags, hashtags_mode: form.hashtags_mode, ...payload })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || 'Save failed');
      await load();
      cancelEdit();
    } catch (e:any) {
      alert(e.message || 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: Meal) {
    const r = await fetch('/api/chef/meals/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mealId: m.id, is_active: !m.is_active })
    });
    if (r.ok) load();
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!meals.length) return <div className="text-sm text-muted-foreground">No meals yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-4">Share</th>
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Slug</th>
            <th className="py-2 pr-4">Price</th>
            <th className="py-2 pr-4">Qty</th>
            <th className="py-2 pr-4">Max/Order</th>
            <th className="py-2 pr-4">Cuisines</th>
            <th className="py-2 pr-4">Active</th>
            <th className="py-2 pr-4">Auto-deactivate</th>
            <th className="py-2 pr-4"></th>
          </tr>
        </thead>
        <tbody>
          {meals.map(m => {
            const editing = editingId === m.id;
            return (
              <tr key={m.id} className="border-t align-top">
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <a className="rounded-md border px-3 py-1 text-xs"
                      href={`/api/public/meal/${(m as any).slug || m.id}/share-image?size=1080`} target="_blank">
                      Download square
                    </a>
                  </div>
                </td>
                <td className="py-2 pr-4">{new Date(m.created_at).toLocaleString()}</td>
                <td className="py-2 pr-4">
                  {editing ? (
                    <Input value={form.title} onChange={(e)=>setForm((f:any)=>({...f, title: e.target.value}))} />
                  ) : m.title}
                </td>
                <td className="py-2 pr-4">
                    {!editing ? (
                        <div className="flex items-center gap-2">
                        <a className="underline text-xs" href={`/meals/${(m as any).slug || m.id}`} target="_blank" rel="noreferrer">
                            /meals/{(m as any).slug || m.id}
                        </a>
                        </div>
                    ) : (
                        <div className="space-y-1">
                        <input
                            value={form.slug || ''}
                            onChange={(e)=>setForm((f:any)=>({ ...f, slug: slugify(e.target.value) }))}
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            maxLength={60}
                            placeholder="e.g., lasagna-bolognese"
                        />
                        <div className="text-[11px]">
                            Preview:&nbsp; <code>/meals/{form.slug || 'meal'}</code>
                            {form.slugStatus?.state === 'checking' && <span className="ml-1">Checking…</span>}
                            {form.slugStatus?.state === 'ok' && <span className="ml-1 text-emerald-700">Available</span>}
                            {form.slugStatus?.state === 'taken' && (
                            <span className="ml-1 text-rose-700">Taken{form.slugStatus?.suggestion ? ` — try "${form.slugStatus.suggestion}"` : ''}</span>
                            )}
                        </div>
                        </div>
                    )}
                    </td>
                <td className="py-2 pr-4">
                  {editing ? (
                    <Input
                      value={form.price_cents}
                      onChange={(e)=>setForm((f:any)=>({...f, price_cents: parseInt(e.target.value||'0',10)}))}
                      inputMode="numeric"
                    />
                  ) : `$${(m.price_cents/100).toFixed(2)}`}
                </td>
                <td className="py-2 pr-4">
                  {editing ? (
                    <Input
                      value={form.qty_available}
                      onChange={(e)=>setForm((f:any)=>({...f, qty_available: parseInt(e.target.value||'0',10)}))}
                      inputMode="numeric"
                    />
                  ) : (m.qty_available ?? '—')}
                </td>
                <td className="py-2 pr-4">
                  {editing ? (
                    <Input
                      value={form.max_per_order}
                      onChange={(e)=>setForm((f:any)=>({...f, max_per_order: parseInt(e.target.value||'1',10)}))}
                      inputMode="numeric"
                    />
                  ) : (m.max_per_order ?? '—')}
                </td>
                <td className="py-2 pr-4">
                  {editing ? (
                    <TagInput
                      value={form.cuisines || []}
                      onChange={(tags)=>setForm((f:any)=>({...f, cuisines: tags}))}
                      suggestions={cuisineOpts}
                      maxTags={5}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(m.cuisines ?? []).map(c => (
                        <span key={c} className="rounded-full border px-2 py-0.5 text-xs">{c}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span className={[
                    'inline-flex items-center rounded-full px-2 py-0.5 text-xs',
                    m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                  ].join(' ')}>{m.is_active ? 'yes' : 'no'}</span>
                </td>
                <td className="py-2 pr-4">
                    {editing ? (
                        <label className="inline-flex items-center gap-2 text-xs">
                        <input
                            type="checkbox"
                            checked={!!form.auto_deactivate_when_sold_out}
                            onChange={(e)=>setForm((f:any)=>({...f, auto_deactivate_when_sold_out: e.target.checked}))}
                        />
                        Auto-deactivate at 0
                        </label>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                        {(m as any).auto_deactivate_when_sold_out ? 'auto' : 'manual'}
                        </span>
                    )}
                </td>
                <td className="py-2 pr-4 whitespace-nowrap">
                  {!editing ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShareMeal({
                        id: m.id, slug: (m as any).slug, title: m.title, price_cents: m.price_cents, cuisines: (m as any).cuisines
                      })}>
                        Share
                      </Button>

                      <Button size="sm" variant="outline" onClick={() => beginEdit(m)}>Edit</Button>
                      <Button size="sm" onClick={() => toggleActive(m)}>{m.is_active ? 'Deactivate' : 'Activate'}</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                      <Button size="sm" onClick={() => saveEdit(m.id)} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {shareMeal && <ShareModal open={!!shareMeal} onClose={() => setShareMeal(null)} meal={shareMeal} />}
    </div>
  );
}
