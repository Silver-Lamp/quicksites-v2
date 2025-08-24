'use client';

import * as React from 'react';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Loader2, PlayCircle, LinkIcon, Sparkles, Plus, Copy } from 'lucide-react';
import VideoUploadCard from '@/components/admin/features/video-upload-card';
import { Switch } from '@/components/ui/switch';
import { Star, StarOff } from 'lucide-react';

type FeatureRow = {
  id: string;
  title: string;
  blurb: string;
  category: 'Editor' | 'SEO' | 'Hosting' | 'AI' | 'Admin' | 'Leads';
  video_url?: string | null;
  doc_href?: string | null;
  badge?: string | null;
  created_at?: string;
  featured?: boolean | null;
  feature_order?: number | null;
};

const CATEGORIES: FeatureRow['category'][] = ['Editor','SEO','Hosting','AI','Admin','Leads'];

function classNames(...xs: (string | null | undefined | false)[]) {
  return xs.filter(Boolean).join(' ');
}

export default function AdminFeatureUploadPage() {
  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [featured, setFeatured] = React.useState(false);
  const [featureOrder, setFeatureOrder] = React.useState<number | ''>('');

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<Partial<FeatureRow>>({});
  
  function startEdit(r: FeatureRow) {
    setEditingId(r.id);
    setEditDraft({
      title: r.title,
      blurb: r.blurb,
      badge: r.badge ?? '',
      doc_href: r.doc_href ?? '',
      video_url: r.video_url ?? '',
    });
  }
  
  async function saveEdit(id: string) {
    const { error } = await supabase
      .from('features')
      .update({
        title: editDraft.title?.trim(),
        blurb: editDraft.blurb?.trim(),
        badge: (editDraft.badge ?? '').trim() || null,
        doc_href: (editDraft.doc_href ?? '').trim() || null,
        video_url: (editDraft.video_url ?? '').trim() || null,
        feature_order: editDraft.feature_order ?? null,
        featured: editDraft.featured ?? false
      })
      .eq('id', id);
    if (error) return alert(error.message);
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...editDraft } as FeatureRow : r))
    );
    setEditingId(null);
    setEditDraft({});
  }
  
  async function deleteRow(id: string) {
    if (!confirm('Delete this feature?')) return;
    const { error } = await supabase.from('features').delete().eq('id', id);
    if (error) return alert(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
  }
  
  // form state
  const [title, setTitle] = React.useState('');
  const [blurb, setBlurb] = React.useState('');
  const [category, setCategory] = React.useState<FeatureRow['category']>('Editor');
  const [videoUrl, setVideoUrl] = React.useState('');
  const [docHref, setDocHref] = React.useState('');
  const [badge, setBadge] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // list state
  const [rows, setRows] = React.useState<FeatureRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 12;
  const [hasMore, setHasMore] = React.useState(false);

  React.useEffect(() => { void fetchPage(0); }, []);

  async function fetchPage(p: number) {
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from('features')
        .select('*', { count: 'exact' })
        .order('featured', { ascending: false })
        .order('feature_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (!error) {
      setRows(data as FeatureRow[]);
      setPage(p);
      setHasMore(((count ?? 0) - (to + 1)) > 0);
    } else {
      console.error(error);
    }
    setLoading(false);
  }

  function validUrl(u: string) {
    if (!u) return true;
    try {
      const parsed = new URL(u);
      return !!parsed.protocol && !!parsed.host;
    } catch {
      return false;
    }
  }

  const canSave =
    title.trim().length > 0 &&
    blurb.trim().length > 0 &&
    CATEGORIES.includes(category) &&
    validUrl(videoUrl) &&
    validUrl(docHref);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const { data, error } = await supabase.from('features').insert({
      title: title.trim(),
      blurb: blurb.trim(),
      category,
      video_url: videoUrl.trim() || null,
      doc_href: docHref.trim() || null,
      badge: badge.trim() || null,
      featured,
      feature_order: featureOrder === '' ? null : Number(featureOrder),
    }).select('*').single();

    setSaving(false);
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }
    // prepend new row in UI
    setRows((prev) => [data as FeatureRow, ...prev]);
    // reset form (keep videoUrl so you can add multiples quickly)
    setTitle('');
    setBlurb('');
    setBadge('');
    setDocHref('');
    // setFeatured(false); // uncomment if you want to reset
  }
  async function toggleFeatured(id: string, next: boolean) {
    const { error } = await supabase.from('features').update({ featured: next }).eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, featured: next } : r)));
  }
  async function setOrder(id: string, n: number | null) {
    const { error } = await supabase.from('features')
      .update({ feature_order: n })
      .eq('id', id);
    if (error) return alert(error.message);
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, feature_order: n } : r));
  }
  
  async function bump(id: string, dir: -1 | 1) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const curr = row.feature_order ?? 999999; // push NULLs to the end
    await setOrder(id, Math.max(0, curr + dir));
  }
  
  async function sendToTop(id: string) {
    // Find current minimum among featured (or all; adjust if you want featured-only behavior)
    const min = rows.reduce((m, r) =>
      r.feature_order != null && r.feature_order < m ? r.feature_order : m, Number.POSITIVE_INFINITY);
    const top = (min === Number.POSITIVE_INFINITY ? 0 : Math.max(0, min - 1));
    await setOrder(id, top);
  }
  
  return (
    <div className="relative">
      {/* hero */}
      <section className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-6xl px-6 pt-14 pb-6"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="outline">Admin</Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Feature uploader
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Upload feature demos
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Add screen-capture videos and details. These appear on the public <Link href="/features" className="underline">Features</Link> page.
          </p>
        </motion.div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </section>

      {/* uploader + form */}
      <section className="mx-auto max-w-6xl px-6 grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
        <VideoUploadCard
          onUploaded={(u) => setVideoUrl(u)}
          bucket="videos"
        />

        <Card>
          <CardHeader>
            <CardTitle>Feature details</CardTitle>
            <CardDescription>Title, blurb, category, and optional links.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="featured">Featured</Label>
                <p className="text-xs text-muted-foreground">Show on homepage highlights.</p>
              </div>
              <Switch id="featured" checked={featured} onCheckedChange={setFeatured} />
            </div>
            <div>
            <Label htmlFor="order">Order (lower = earlier)</Label>
            <div className="mt-2 flex items-center gap-2">
              <Input
                id="order"
                type="number"
                inputMode="numeric"
                placeholder="(optional)"
                value={featureOrder}
                onChange={(e) =>
                  setFeatureOrder(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">Leave blank for auto</span>
            </div>
          </div>

            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Block-based template editor" />
            </div>
            <div>
              <Label htmlFor="blurb">Blurb</Label>
              <Textarea id="blurb" rows={4} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Compose pages with reusable blocks, tweak themes, and publish instantly." />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as FeatureRow['category'])}>
                <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="video">Video URL</Label>
              <div className="mt-2 flex gap-2 items-center">
                <PlayCircle className="h-4 w-4 text-muted-foreground" />
                <Input id="video" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://... (YouTube/Vimeo/MP4)" />
                {videoUrl && (
                  <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(videoUrl)} title="Copy">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!validUrl(videoUrl) && <p className="mt-1 text-xs text-red-500">Enter a valid URL or leave blank.</p>}
            </div>
            <div>
              <Label htmlFor="doc">Docs link (optional)</Label>
              <div className="mt-2 flex gap-2 items-center">
                <LinkIcon className="h-4 w-4 text-muted-foreground" />
                <Input id="doc" value={docHref} onChange={(e) => setDocHref(e.target.value)} placeholder="https://docs..." />
              </div>
              {!validUrl(docHref) && <p className="mt-1 text-xs text-red-500">Enter a valid URL or leave blank.</p>}
            </div>
            <div>
              <Label htmlFor="badge">Badge (optional)</Label>
              <Input id="badge" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="Core, Add-on, Best practice..." />
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <div className="text-xs text-muted-foreground">New entries are visible instantly on <Link href="/features" className="underline">/features</Link>.</div>
            <Button onClick={onSave} disabled={!canSave || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Save feature
            </Button>
          </CardFooter>
        </Card>
      </section>

      {/* existing features */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <Card>
          <CardHeader>
            <CardTitle>Existing features</CardTitle>
            <CardDescription>Newest first</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">No features yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {rows.map((r) => (
                  <Card key={r.id} className="overflow-hidden">
                    <CardHeader className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{r.title}</CardTitle>
                          <Badge variant="secondary">{r.category}</Badge>
                          {r.badge ? <Badge variant="outline">{r.badge}</Badge> : null}
                          {r.featured ? <Badge variant="default">Featured</Badge> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => (editingId === r.id ? setEditingId(null) : startEdit(r))}>
                            {editingId === r.id ? 'Cancel' : 'Edit'}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteRow(r.id)}>
                            Delete
                          </Button>
                        </div>
                        <div className="hidden md:flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => bump(r.id, -1)} title="Move earlier">–</Button>
                          <div className="text-xs text-muted-foreground w-10 text-center">
                            {r.feature_order ?? '—'}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => bump(r.id, +1)} title="Move later">+</Button>
                          <Button size="sm" variant="secondary" onClick={() => sendToTop(r.id)} title="Send to top">Top</Button>
                        </div>
                        <div>
                          <Label>Order</Label>
                          <Input
                            type="number"
                            value={editDraft.feature_order ?? ''}
                            onChange={(e) =>
                              setEditDraft((d) => ({
                                ...d,
                                feature_order: e.target.value === '' ? null : Number(e.target.value),
                              }))
                            }
                          />
                        </div>

                      </div>
                      <CardDescription className="line-clamp-2">{r.blurb}</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {editingId === r.id ? (
                        <div className="grid grid-cols-1 gap-3">
                          <div>
                            <Label>Title</Label>
                            <Input
                              value={editDraft.title ?? ''}
                              onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Blurb</Label>
                            <Textarea
                              rows={3}
                              value={editDraft.blurb ?? ''}
                              onChange={(e) => setEditDraft((d) => ({ ...d, blurb: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Badge</Label>
                            <Input
                              value={editDraft.badge ?? ''}
                              onChange={(e) => setEditDraft((d) => ({ ...d, badge: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Docs link</Label>
                            <Input
                              value={editDraft.doc_href ?? ''}
                              onChange={(e) => setEditDraft((d) => ({ ...d, doc_href: e.target.value }))}
                            />
                          </div>
                          <div>
                            <Label>Video URL</Label>
                            <Input
                              value={editDraft.video_url ?? ''}
                              onChange={(e) => setEditDraft((d) => ({ ...d, video_url: e.target.value }))}
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button onClick={() => saveEdit(r.id)}>Save</Button>
                          </div>
                        </div>
                      ) : r.video_url ? (
                        <div className="aspect-video rounded-lg overflow-hidden border">
                          <video className="h-full w-full" controls preload="metadata" src={r.video_url} />
                        </div>
                      ) : (
                        <div className="aspect-video rounded-lg border bg-muted/40 grid place-items-center text-muted-foreground text-sm">
                          No video
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground break-all">
                        {r.doc_href ? <Link href={r.doc_href} className="underline">Docs</Link> : '—'}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => fetchPage(Math.max(0, page - 1))} disabled={page === 0}>
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">Page {page + 1}</div>
            <Button variant="outline" onClick={() => fetchPage(page + 1)} disabled={!hasMore}>
              Next
            </Button>
          </CardFooter>
        </Card>
      </section>
    </div>
  );
}
