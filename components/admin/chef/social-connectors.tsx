'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Hook = {
  id:string; name:string; endpoint_url:string; kind:'slack'|'discord'|'generic';
  enabled?: boolean | null;
  template_text_drop?: string | null;
  template_text_last_call?: string | null;
  template_text_custom?: string | null;
  template_include_image?: boolean | null;
  template_include_link?: boolean | null;
  last_test_at?: string | null;
  last_test_status?: string | null;
  last_test_error?: string | null;
  default_hashtags?: string | null;
};

type MealLite = { id:string; title:string; slug?:string|null; price_cents:number };

export default function SocialConnectors({ siteId }: { siteId: string }) {
  const [list, setList] = useState<Hook[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const [meals, setMeals] = useState<MealLite[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testMeal, setTestMeal] = useState<string>('');
  const [testKind, setTestKind] = useState<'drop'|'last_call'|'custom'>('drop');
  const [preview, setPreview] = useState<Record<string, any> | null>(null);
  const [testing, setTesting] = useState(false);

  async function load() {
    const r = await fetch('/api/chef/social/webhooks/list');
    const d = await r.json();
    setList(d?.webhooks ?? []);
  }
  async function loadMeals() {
    // Reuse your list endpoint; include slug/price for context (adjust select on server if needed)
    const r = await fetch(`/api/chef/meals/list?siteId=${encodeURIComponent(siteId)}`);
    const d = await r.json();
    const arr = (d?.meals ?? []).map((m:any) => ({ id: m.id, title: m.title, slug: m.slug, price_cents: m.price_cents }));
    setMeals(arr);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { if (siteId) loadMeals(); }, [siteId]);

  async function save(h: Hook, patch: Partial<Hook>) {
    await fetch('/api/chef/social/webhooks/update', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id: h.id, ...patch })
    });
    await load();
  }

  async function doPreview(h: Hook) {
    if (!testMeal) { alert('Pick a meal to preview'); return; }
    setPreview(null);
    const r = await fetch('/api/chef/social/webhooks/test', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ webhook_id: h.id, meal_id: testMeal, kind: testKind, send: false })
    });
    const d = await r.json();
    if (!r.ok) { alert(d?.error || 'Preview failed'); return; }
    setPreview(d.preview);
  }

  async function doSend(h: Hook) {
    if (!testMeal) { alert('Pick a meal'); return; }
    setTesting(true);
    const r = await fetch('/api/chef/social/webhooks/test', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ webhook_id: h.id, meal_id: testMeal, kind: testKind, send: true })
    });
    setTesting(false);
    if (r.ok) { alert('Test sent!'); load(); }
    else {
      const d = await r.json().catch(()=>({}));
      alert(d?.error || 'Send failed');
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-4">
        <h3 className="text-base font-semibold mb-2">Add a webhook</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Discord #announcements" />
          </div>
          <div className="sm:col-span-2">
            <Label>Endpoint URL</Label>
            <Input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" />
          </div>
        </div>
        <div className="pt-2">
          <Button
            disabled={!name || !url || busy}
            onClick={async () => {
              setBusy(true);
              const r = await fetch('/api/chef/social/webhooks/create', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body: JSON.stringify({ name, endpoint_url: url })
              });
              setBusy(false);
              if (r.ok) { setName(''); setUrl(''); load(); } else alert('Failed to add');
            }}
          >
            Add connector
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border p-4">
        <h3 className="text-base font-semibold mb-2">Your connectors</h3>
        {!list.length ? (
          <div className="text-sm text-muted-foreground">No webhooks yet.</div>
        ) : (
          <div className="space-y-2">
            {list.map(h => {
              const open = expanded === h.id;
              return (
                <div key={h.id} className="rounded-xl border">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">{h.name}</div>
                      <div className="text-xs text-muted-foreground">({h.kind})</div>
                      {h.last_test_status && (
                        <div className={`text-xs ${h.last_test_status==='sent' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          last test: {h.last_test_status}{h.last_test_at ? ` • ${new Date(h.last_test_at).toLocaleString()}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={h.enabled !== false}
                          onChange={(e)=>save(h, { enabled: e.target.checked as any })}
                        /> Enabled
                      </label>
                      <Button size="sm" variant="outline" onClick={()=>setExpanded(open ? null : h.id)}>
                        {open ? 'Close' : 'Edit / Test'}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        onClick={async () => {
                          const ok = confirm('Delete connector?');
                          if (!ok) return;
                          const r = await fetch('/api/chef/social/webhooks/delete', {
                            method:'POST', headers:{'Content-Type':'application/json'},
                            body: JSON.stringify({ id: h.id })
                          });
                          if (r.ok) load();
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  {open && (
                    <div className="px-4 pb-4 space-y-4 border-t">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs">“Drop” template</Label>
                          <Textarea
                            rows={4}
                            placeholder="e.g., 🍽️ meal_title — price\n#hashtags\nlink"
                            defaultValue={h.template_text_drop || ''}
                            onBlur={(e)=>save(h, { template_text_drop: e.target.value as any })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Vars: meal_title, price, chef_name, link, qty, cuisines, hashtags. Sections: #hashtags...
                          </p>
                        </div>

                        {/* new */}
                        <div className="space-y-1">
                            <Label className="text-xs">Default hashtags</Label>
                            <Input
                                placeholder="#sf #bayarea  (or: sf, bayarea)"
                                defaultValue={h.default_hashtags || ''}
                                onBlur={(e)=>save(h, { default_hashtags: e.target.value as any })}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Used on this connector. Meal-specific hashtags can append or replace these.
                            </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">“Last call” template</Label>
                          <Textarea
                            rows={4}
                            placeholder="⏳ Last portions of meal_title — price\nlink"
                            defaultValue={h.template_text_last_call || ''}
                            onBlur={(e)=>save(h, { template_text_last_call: e.target.value as any })}
                          />
                          <div className="flex items-center gap-4 pt-1">
                            <label className="text-xs flex items-center gap-2">
                              <input
                                type="checkbox"
                                defaultChecked={h.template_include_image !== false}
                                onChange={(e)=>save(h, { template_include_image: e.target.checked as any })}
                              /> Include image
                            </label>
                            <label className="text-xs flex items-center gap-2">
                              <input
                                type="checkbox"
                                defaultChecked={h.template_include_link !== false}
                                onChange={(e)=>save(h, { template_include_link: e.target.checked as any })}
                              /> Include link
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Test / Preview */}
                      <div className="rounded-lg border p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <Label className="text-xs">Test with meal</Label>
                          <select
                            className="rounded-md border px-2 py-1 text-sm bg-background"
                            value={testMeal}
                            onChange={(e)=>setTestMeal(e.target.value)}
                          >
                            <option value="">Select…</option>
                            {meals.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                          </select>

                          <Label className="text-xs">Kind</Label>
                          <select
                            className="rounded-md border px-2 py-1 text-sm bg-background"
                            value={testKind}
                            onChange={(e)=>setTestKind(e.target.value as any)}
                          >
                            <option value="drop">drop</option>
                            <option value="last_call">last_call</option>
                            <option value="custom">custom</option>
                          </select>

                          <Button size="sm" variant="outline" onClick={() => doPreview(h)}>Preview</Button>
                          <Button size="sm" onClick={() => doSend(h)} disabled={testing}>
                            {testing ? 'Sending…' : 'Send test'}
                          </Button>
                        </div>

                        {preview && (
                          <div className="text-xs bg-muted/40 rounded-md p-2">
                            <div><span className="font-medium">Preview text:</span> {preview.text}</div>
                            {preview.link && <div><span className="font-medium">Link:</span> {preview.link}</div>}
                            {preview.image && <div><span className="font-medium">Image:</span> {preview.image}</div>}
                            <div className="text-muted-foreground">to {preview.to} ({preview.provider})</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
