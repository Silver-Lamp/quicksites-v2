'use client';

import * as React from 'react';
import Link from 'next/link';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
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
import { Switch } from '@/components/ui/switch';
import {
    AlertCircle, Loader2, Search, Plus, Copy, Trash2, Save, Stars, 
    ArrowLeftRight, Sparkles, ExternalLink, Replace
} from 'lucide-react';

import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
  } from '@/components/ui/dialog';
  import VideoUploadCard from '@/components/admin/features/video-upload-card';

  import { Checkbox } from '@/components/ui/checkbox';



type FeatureRow = {
  id: string;
  title: string;
  blurb: string;
  category: 'Editor' | 'SEO' | 'Hosting' | 'AI' | 'Admin' | 'Leads' | string;
  video_url?: string | null;
  doc_href?: string | null;
  badge?: string | null;
  featured?: boolean | null;
  feature_order?: number | null;
  created_at?: string | null;
};

const CATEGORIES: FeatureRow['category'][] = ['Editor', 'SEO', 'Hosting', 'AI', 'Admin', 'Leads'];

function classNames(...xs: (string | null | undefined | false)[]) {
  return xs.filter(Boolean).join(' ');
}

function ConfirmDialogButton({
    trigger,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'destructive',
    onConfirm,
    body, // optional extra JSX between header and footer
  }: {
    trigger: React.ReactElement;           // e.g. <Button>Delete</Button>
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
    onConfirm: () => void | Promise<void>;
    body?: React.ReactNode;
  }) {
    const [open, setOpen] = React.useState(false);
    const handle = async () => { await onConfirm(); setOpen(false); };
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {body}
          <div className="mt-4 flex justify-end gap-2">
            <button className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm"
                    onClick={() => setOpen(false)}>
              {cancelText}
            </button>
            <button className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm ${
                confirmVariant === 'destructive'
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600'
              }`}
              onClick={handle}>
              {confirmText}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  
// ---------------------------------------------
// Reusable form (used for New and Edit)
// ---------------------------------------------
function FeatureForm({
    draft,
    setDraft,
    onSave,
    onDelete,
    onDuplicate,
    saving,
    isEditing,
    authed,
  }: {
    draft: Partial<FeatureRow>;
    setDraft: (updater: (prev: Partial<FeatureRow>) => Partial<FeatureRow>) => void;
    onSave: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    saving: boolean;
    isEditing: boolean;
    authed: boolean;
  }) {

// Supabase client (browser)
const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  
  function upsertableFeaturePayload(d: Partial<FeatureRow>) {
    return {
      title: d.title?.trim() ?? '',
      blurb: d.blurb?.trim() ?? '',
      category: (d.category as string) ?? 'Editor',
      badge: (d.badge ?? '').trim() || null,
      doc_href: (d.doc_href ?? '').trim() || null,
      video_url: (d.video_url ?? '').trim() || null,
      featured: !!d.featured,
      feature_order: d.feature_order ?? null,
    };
  }
  
  // Parse a Supabase *public* URL => { bucket, path }, else null
  function parsePublicStorageUrl(u?: string | null): { bucket: string; path: string } | null {
    if (!u) return null;
    try {
      const url = new URL(u);
      const marker = '/storage/v1/object/public/';
      const idx = url.pathname.indexOf(marker);
      if (idx === -1) return null;
      const tail = url.pathname.slice(idx + marker.length); // "<bucket>/<path...>"
      const parts = tail.split('/');
      const bucket = parts.shift();
      const path = parts.join('/');
      if (!bucket || !path) return null;
      return { bucket, path: decodeURIComponent(path) };
    } catch {
      return null;
    }
  }
  
    
    const [uploaderOpen, setUploaderOpen] = React.useState(false);
    const [alsoDelete, setAlsoDelete] = React.useState(false);

    React.useEffect(() => {
        (async () => {
          const { data: auth } = await supabase.auth.getUser();
          if (!auth?.user) {
            console.warn('No Supabase session — updates will fail RLS.');
            // Optional: redirect to login or show a banner/toast here.
          }
        })();
      }, [supabase]);

    const canSave =
      (draft.title?.trim()?.length ?? 0) > 0 &&
      (draft.blurb?.trim()?.length ?? 0) > 0 &&
      (!!draft.category && String(draft.category).length > 0);
  
    return (
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>{isEditing ? 'Edit feature' : 'Create feature'}</CardTitle>
              <CardDescription>One form for new and edits. Toggle “Featured” to show on homepage.</CardDescription>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {isEditing && onDuplicate && (
                <Button type="button" variant="outline" size="sm" onClick={onDuplicate} title="Duplicate">
                  <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none"><path d="M8 8h10v10H8z" stroke="currentColor"/><path d="M6 6h10v10" stroke="currentColor"/></svg>
                  Duplicate
                </Button>
              )}
                {isEditing && onDelete && (
                    <ConfirmDialogButton
                    trigger={<Button type="button" variant="destructive" size="sm">Delete</Button>}
                    title="Delete this feature?"
                    description="This action cannot be undone."
                    confirmText="Delete"
                    onConfirm={onDelete!}
                    />
                )}

                <Button type="button" onClick={onSave} disabled={!canSave || saving}>
                {saving ? <span className="mr-2 h-4 w-4 animate-spin border-2 border-transparent border-t-current rounded-full" /> : null}
                {isEditing ? 'Save' : 'Create'}
                </Button>

            </div>
          </div>
        </CardHeader>
        {!authed && (
        <p className="mt-1 text-xs text-red-300">
            Log in to enable saving.
        </p>
        )}
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={draft.title ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Block-based template editor"
            />
          </div>
  
          <div>
            <Label htmlFor="blurb">Blurb</Label>
            <Textarea
              id="blurb"
              rows={4}
              value={draft.blurb ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))}
              placeholder="Compose pages with reusable blocks, tweak themes, and publish instantly."
            />
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select
                value={(draft.category as string) || 'Editor'}
                onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="badge">Badge (optional)</Label>
              <Input
                id="badge"
                value={draft.badge ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, badge: e.target.value }))}
                placeholder="Core, + Add-on, Best practice…"
              />
            </div>
          </div>
  
          <div>
            <Label htmlFor="doc">Docs link (optional)</Label>
            <Input
              id="doc"
              value={draft.doc_href ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, doc_href: e.target.value }))}
              placeholder="https://docs…"
            />
          </div>
  
          {/* Video URL + Uploader dialog */}
          <div>
            <Label htmlFor="video">Video URL (YouTube/Vimeo/MP4)</Label>
            <div className="mt-2 flex gap-2 items-center">
              <Input
                id="video"
                value={draft.video_url ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, video_url: e.target.value }))}
                placeholder="https://…"
                className="flex-1"
              />
              <Dialog open={uploaderOpen} onOpenChange={setUploaderOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">Upload video</Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Upload feature demo</DialogTitle>
                    <DialogDescription>
                      Upload an MP4/WebM/Ogg to the <code>videos</code> bucket. We’ll auto-fill the URL below.
                    </DialogDescription>
                  </DialogHeader>
                  <VideoUploadCard
                    bucket="videos"
                    onUploaded={(url) => {
                      setDraft((d) => ({ ...d, video_url: url }));
                      setUploaderOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
  
            {/* Inline preview + actions */}
            {draft.video_url ? (
            <div className="mt-3 space-y-2">
                <div className="aspect-video rounded-lg overflow-hidden border">
                {/\.(mp4|webm|ogg)(\?.*)?$/i.test(draft.video_url) ? (
                    <video className="h-full w-full" controls preload="metadata" src={draft.video_url} />
                ) : (
                    <iframe className="h-full w-full" src={draft.video_url} title="Preview" loading="lazy" />
                )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setUploaderOpen(true)}
                    title="Replace video"
                >
                    <Replace className="h-4 w-4 mr-1" />
                    Replace video
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                    navigator.clipboard.writeText(String(draft.video_url));
                    }}
                    title="Copy URL"
                >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy URL
                </Button>

                <a
                    href={String(draft.video_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                    title="Open in new tab"
                >
                    <Button type="button" variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                    </Button>
                </a>

                {/* Remove with confirmation */}
                <ConfirmDialogButton
                    trigger={
                        <Button type="button" variant="destructive" size="sm" title="Remove video">
                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                        </Button>
                    }
                    title="Remove this video URL?"
                    description="You can also delete the underlying file from Supabase Storage."
                    confirmText="Remove"
                    onConfirm={async () => {
                        if (alsoDelete) {
                        const parsed = parsePublicStorageUrl(draft.video_url);
                        if (parsed) {
                            const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
                            if (error) alert(`Delete failed: ${error.message}`);
                        }
                        }
                        setDraft((d) => ({ ...d, video_url: '' }));
                        setAlsoDelete(false);
                    }}
                    body={
                        <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox checked={alsoDelete} onCheckedChange={(v) => setAlsoDelete(!!v)} />
                        Also delete file from storage
                        </label>
                    }
                    />
                </div>

            </div>
            ) : null}

          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="featured">Featured</Label>
                <p className="text-xs text-muted-foreground">Show this on the homepage highlights.</p>
              </div>
              <Switch
                id="featured"
                checked={!!draft.featured}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, featured: v }))}
              />
            </div>
            <div>
              <Label htmlFor="order">Order (lower = earlier)</Label>
              <Input
                id="order"
                type="number"
                inputMode="numeric"
                placeholder="(optional)"
                value={draft.feature_order ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, feature_order: e.target.value === '' ? null : Number(e.target.value) }))
                }
              />
            </div>
          </div>
        </CardContent>
  
        <CardFooter className="md:hidden flex justify-end gap-2">
          {isEditing && onDuplicate && (
            <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>Duplicate</Button>
          )}
          {isEditing && onDelete && (
            <Button type="button" variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
          )}
          <Button type="button" onClick={onSave} disabled={!canSave || saving}>
            {isEditing ? 'Save' : 'Create'}
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
// ---------------------------------------------
// Page
// ---------------------------------------------
export default function ManageFeaturesPage() {
  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  const [authed, setAuthed] = React.useState(false);
  const [authChecked, setAuthChecked] = React.useState(false);
  
  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setAuthed(!!data?.user);
      setAuthChecked(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session?.user);
    });
    return () => sub.subscription?.unsubscribe?.();
  }, [supabase]);
  
  const [rows, setRows] = React.useState<FeatureRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Partial<FeatureRow>>({});
  const [saving, setSaving] = React.useState(false);

  // fetch list
  React.useEffect(() => {
    void fetchRows();
  }, []);

  async function fetchRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from('features')
      .select('*')
      .order('featured', { ascending: false })
      .order('feature_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
  
    if (error) {
      console.error('Fetch features failed:', error);
    }
    if (!error) setRows((data || []) as FeatureRow[]);
    setLoading(false);
  }
  

  function startNew() {
    setSelectedId(null);
    setDraft({
      title: '',
      blurb: '',
      category: 'Editor',
      badge: '',
      doc_href: '',
      video_url: '',
      featured: false,
      feature_order: null,
    });
  }

  function startEdit(r: FeatureRow) {
    setSelectedId(r.id);
    setDraft({
      title: r.title,
      blurb: r.blurb,
      category: r.category,
      badge: r.badge ?? '',
      doc_href: r.doc_href ?? '',
      video_url: r.video_url ?? '',
      featured: !!r.featured,
      feature_order: r.feature_order ?? null,
    });
  }

  async function onSave() {
    setSaving(true);
    try {
      if (!draft.title || !draft.blurb || !draft.category) {
        alert('Title, blurb, and category are required.');
        return;
      }
      const payload = upsertableFeaturePayload(draft);
      let saved: FeatureRow;
  
      if (selectedId) {
        saved = await saveFeatureServer({ id: selectedId, ...payload });
        setRows((prev) => prev.map((r) => (r.id === selectedId ? saved : r)));
      } else {
        saved = await saveFeatureServer(payload);
        setRows((prev) => [saved, ...prev]);
        setSelectedId(saved.id);
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Save failed');
    } finally {
      setSaving(false);
      void fetchRows(); // keep server order in sync
    }
  }
  
  

  async function onDelete() {
    if (!selectedId) return;
    try {
      await deleteFeatureServer(selectedId);
      setRows((prev) => prev.filter((r) => r.id !== selectedId));
      startNew();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Delete failed');
    }
  }
  

  async function onDuplicate() {
    if (!selectedId) return;
    const src = rows.find((r) => r.id === selectedId);
    if (!src) return;
    const { error } = await supabase.from('features').insert({
      title: `${src.title} (copy)`,
      blurb: src.blurb,
      category: src.category,
      badge: src.badge,
      doc_href: src.doc_href,
      video_url: src.video_url,
      featured: src.featured ?? false,
      feature_order: (src.feature_order ?? 0) + 1,
    });
    if (error) alert(error.message);
    else await fetchRows();
  }

  // derived
  const filtered = React.useMemo(() => {
    const n = search.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(n) ||
        r.blurb.toLowerCase().includes(n) ||
        (r.category || '').toString().toLowerCase().includes(n)
    );
  }, [rows, search]);

  // init form with first row if none selected
  React.useEffect(() => {
    if (!loading && !selectedId && rows.length > 0 && !draft.title) {
      startEdit(rows[0]);
    }
  }, [loading, rows]); // eslint-disable-line

  async function saveFeatureServer(payload: Partial<FeatureRow> & { id?: string }) {
    const res = await fetch('/api/features/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Save failed');
    return json.data as FeatureRow;
  }
  
  async function deleteFeatureServer(id: string) {
    const res = await fetch('/api/features/delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || 'Delete failed');
    return true;
  }
  
  function upsertableFeaturePayload(d: Partial<FeatureRow>) {
    return {
      title: d.title?.trim() ?? '',
      blurb: d.blurb?.trim() ?? '',
      category: (d.category as string) ?? 'Editor',
      badge: (d.badge ?? '').trim() || null,
      doc_href: (d.doc_href ?? '').trim() || null,
      video_url: (d.video_url ?? '').trim() || null,
      featured: !!d.featured,
      feature_order: d.feature_order ?? null,
    };
  }
  

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-6xl px-6 pt-14 pb-4"
        >
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge variant="outline">Admin</Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Manage features
            </Badge>
          </div>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">Features manager</h1>
          <p className="mt-2 text-muted-foreground">
            Edit existing demos on the left, fill the form on the right. Mark as <b>Featured</b> to appear on the homepage.
          </p>
        </motion.div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      </section>
      {authChecked && !authed && (
        <div className="mx-auto max-w-6xl px-6 pb-4">
            <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm text-red-200">
                    You’re not logged in. Saves will be blocked by database security (RLS).
                </span>
                </div>
                <div className="flex items-center gap-2">
                <Link href="/login" className="inline-flex">
                    <Button size="sm">Log in</Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => location.reload()}>
                    Refresh
                </Button>
                </div>
            </CardContent>
            </Card>
        </div>
        )}

      {/* Split layout */}
      <section className="mx-auto max-w-6xl px-6 pb-10 grid grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)] gap-6">
        {/* Left: scrollable list */}
        <Card className="md:h-[70vh] flex flex-col overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">Existing</CardTitle>
              <Button size="sm" onClick={startNew}>
                <Plus className="h-4 w-4 mr-1" /> New
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, blurb, category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-y-auto [scrollbar-width:thin] md:flex-1">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 inline-block animate-spin" />
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No features yet.</div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((r) => {
                  const active = selectedId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => startEdit(r)}
                      className={classNames(
                        'text-left px-3 py-3 rounded-md border mb-2 transition',
                        active ? 'bg-zinc-900 border-zinc-700' : 'hover:bg-zinc-900 border-zinc-800'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{r.title}</span>
                        {r.featured ? <Badge variant="default">Featured</Badge> : null}
                        {r.badge ? <Badge variant="secondary">{r.badge}</Badge> : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.blurb}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-zinc-800 px-2 py-0.5">{r.category}</span>
                        <span className="rounded bg-zinc-800 px-2 py-0.5">Order: {r.feature_order ?? '—'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: form (new or edit) */}
        <FeatureForm
          draft={draft}
          setDraft={(u) => setDraft((prev) => u(prev))}
          onSave={onSave}
          onDelete={selectedId ? onDelete : undefined}
          onDuplicate={selectedId ? onDuplicate : undefined}
          saving={saving}
          isEditing={!!selectedId}
          authed={authed}
        />
      </section>

      {/* Footer link */}
      <div className="mx-auto max-w-6xl px-6 pb-8 text-sm text-muted-foreground">
        Tip: Public page is <Link href="/features" className="underline">/features</Link>. Homepage shows <b>featured</b> items.
      </div>
    </div>
  );
}
