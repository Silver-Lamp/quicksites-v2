// app/admin/features/manage/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  AlertCircle, Loader2, Search, Plus, Copy, Trash2, Replace, ExternalLink, Sparkles,
} from 'lucide-react';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import VideoUploadCard from '@/components/admin/features/video-upload-card';
import ImageUploadCard from '@/components/admin/features/image-upload-card';
import GalleryUploadCard, { type GalleryItem } from '@/components/admin/features/gallery-upload-card';

import { Checkbox } from '@/components/ui/checkbox';
import { useOrg } from '@/app/providers';

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

type MediaType = 'video' | 'image' | 'link' | 'gallery';

type FeatureRow = {
  id: string;
  title: string;
  blurb: string;
  category: string;
  video_url?: string | null;
  doc_href?: string | null;
  badge?: string | null;
  featured?: boolean | null;
  feature_order?: number | null;
  created_at?: string | null;

  // Portfolio extensions (org-scoped)
  org_id?: string | null;
  org_slug?: string | null;
  slug?: string | null;
  media_type?: MediaType | null;
  image_url?: string | null;
  thumb_url?: string | null;
  site_url?: string | null;
  external_url?: string | null;
  tags?: string[] | null;
  is_public?: boolean | null;
};

type OrgOption = { id: string; slug: string; name: string };

const LEGACY_CATEGORIES = ['Editor', 'SEO', 'Hosting', 'AI', 'Admin', 'Leads'] as const;
const PORTFOLIO_CATEGORIES = [
  ...LEGACY_CATEGORIES,
  'Web', 'Brand', 'E-Commerce', 'Apps', 'Integrations', 'Video', 'Image', 'Link', 'Other',
];

/* ========================================================================== */

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
  body,
}: {
  trigger: React.ReactElement;
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
          <button
            className={classNames(
              'inline-flex items-center rounded-md px-3 py-1.5 text-sm',
              confirmVariant === 'destructive'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600'
            )}
            onClick={handle}
          >
            {confirmText}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ========================================================================== */
/* Reusable form                                                              */
/* ========================================================================== */

function FeatureForm({
  draft,
  setDraft,
  onSave,
  onDelete,
  onDuplicate,
  saving,
  isEditing,
  authed,
  portfolioMode,
}: {
  draft: Partial<FeatureRow>;
  setDraft: (updater: (prev: Partial<FeatureRow>) => Partial<FeatureRow>) => void;
  onSave: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  saving: boolean;
  isEditing: boolean;
  authed: boolean;
  portfolioMode: boolean;
}) {
  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [uploaderOpen, setUploaderOpen] = React.useState(false);
  const [alsoDelete, setAlsoDelete] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) console.warn('No Supabase session — updates will fail RLS.');
    })();
  }, [supabase]);

  function parsePublicStorageUrl(u?: string | null): { bucket: string; path: string } | null {
    if (!u) return null;
    try {
      const url = new URL(u);
      const marker = '/storage/v1/object/public/';
      const idx = url.pathname.indexOf(marker);
      if (idx === -1) return null;
      const tail = url.pathname.slice(idx + marker.length);
      const parts = tail.split('/');
      const bucket = parts.shift();
      const path = parts.join('/');
      if (!bucket || !path) return null;
      return { bucket, path: decodeURIComponent(path) };
    } catch {
      return null;
    }
  }

  const canSaveBase =
    (draft.title?.trim()?.length ?? 0) > 0 &&
    (draft.blurb?.trim()?.length ?? 0) > 0 &&
    (!!draft.category && String(draft.category).length > 0);

  const canSavePortfolio =
    (draft.slug?.trim()?.length ?? 0) > 0 &&
    (!!draft.media_type);

  const canSave = portfolioMode ? (canSaveBase && canSavePortfolio) : canSaveBase;

  // App-dev friendly categories
  const APPDEV_CATEGORIES = [
    'Web',
    'Apps',
    'Dashboards',
    'Data & Analytics',
    'E-commerce',
    'Integrations',
    'Internal Tools',
    'Mobile',
    'AI / Automation',
    'Other',
  ] as const;

  // Keep a small legacy list for the old non-portfolio mode (if you still use it)
  const LEGACY_CATEGORIES = ['Editor', 'SEO', 'Hosting', 'AI', 'Admin', 'Leads'] as const;

  const CATS = portfolioMode ? APPDEV_CATEGORIES : (LEGACY_CATEGORIES as readonly string[]);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>{isEditing ? (portfolioMode ? 'Edit portfolio item' : 'Edit feature') : (portfolioMode ? 'Create portfolio item' : 'Create feature')}</CardTitle>
            <CardDescription>
              {portfolioMode
                ? 'Org-scoped item. Slug + Media Type required. Toggle “Featured” to highlight.'
                : 'One form for new and edits. Toggle “Featured” to show on homepage.'}
            </CardDescription>
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
                title={`Delete this ${portfolioMode ? 'portfolio' : 'feature'} item?`}
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
        <p className="mt-1 px-6 text-xs text-red-300">Log in to enable saving.</p>
      )}

      <CardContent className="space-y-4">
        {/* Portfolio-only: slug + media type */}
        {portfolioMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={draft.slug ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                placeholder="my-project"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Media Type</Label>
              <Select
                value={draft.media_type ?? 'video'}
                onValueChange={(v) => setDraft((d) => ({ ...d, media_type: v as MediaType }))}
              >
                <SelectTrigger><SelectValue placeholder="Choose media type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="gallery">Gallery</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={draft.title ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder={portfolioMode ? 'Client brand redesign' : 'Block-based template editor'}
          />
        </div>

        <div>
          <Label htmlFor="blurb">Blurb</Label>
          <Textarea
            id="blurb"
            rows={4}
            value={draft.blurb ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, blurb: e.target.value }))}
            placeholder={portfolioMode
              ? 'Landing page + CMS + SEO. Shipped in two weeks.'
              : 'Compose pages with reusable blocks, tweak themes, and publish instantly.'}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Category</Label>
            <Select
              value={(draft.category as string) || PORTFOLIO_CATEGORIES[0]}
              onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
              <SelectContent>
                {(portfolioMode ? PORTFOLIO_CATEGORIES : LEGACY_CATEGORIES).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="badge">Badge (optional)</Label>
            <Input
              id="badge"
              value={draft.badge ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, badge: e.target.value }))}
              placeholder="Case Study, Best practice, Core…"
            />
          </div>
          {/* Quick-add badges (optional) */}
          <div className="mt-2 flex flex-wrap gap-2">
            {['Case Study','Prototype','MVP','Production','Core','Open Source','Integration','Replatform','Design Sprint'].map(b => (
              <Button key={b} type="button" size="sm" variant="outline" onClick={() => setDraft(d => ({ ...d, badge: b }))}>
                {b}
              </Button>
            ))}
          </div>

        </div>

        {/* Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="doc">Docs link (optional)</Label>
            <Input id="doc" value={draft.doc_href ?? ''} onChange={(e) => setDraft((d) => ({ ...d, doc_href: e.target.value }))} placeholder="https://docs…" />
          </div>
          {portfolioMode && (
            <div>
              <Label htmlFor="site">Site URL (optional)</Label>
              <Input id="site" value={draft.site_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, site_url: e.target.value }))} placeholder="https://clientsite.com" />
            </div>
          )}
        </div>

        {/* Media inputs */}
        {(!portfolioMode || draft.media_type === 'video') && (
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
                    <DialogTitle>Upload {portfolioMode ? 'portfolio' : 'feature'} demo</DialogTitle>
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

            {draft.video_url ? (
              <div className="mt-3 space-y-2">
                <div className="aspect-video rounded-lg overflow-hidden border">
                  {/\.(mp4|webm|ogg)(\?.*)?$/i.test(String(draft.video_url)) ? (
                    <video className="h-full w-full" controls preload="metadata" src={String(draft.video_url)} />
                  ) : (
                    <iframe className="h-full w-full" src={String(draft.video_url)} title="Preview" loading="lazy" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setUploaderOpen(true)}>
                    <Replace className="h-4 w-4 mr-1" />
                    Replace video
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(String(draft.video_url))}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy URL
                  </Button>
                  <a href={String(draft.video_url)} target="_blank" rel="noopener noreferrer" className="inline-flex">
                    <Button type="button" variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  </a>
                  <ConfirmDialogButton
                    trigger={<Button type="button" variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-1" /> Remove</Button>}
                    title="Remove this video URL?"
                    description="You can also delete the underlying file from Supabase Storage."
                    confirmText="Remove"
                    onConfirm={async () => {
                      const parsed = (() => {
                        try {
                          const url = new URL(String(draft.video_url));
                          const marker = '/storage/v1/object/public/';
                          const idx = url.pathname.indexOf(marker);
                          if (idx === -1) return null;
                          const tail = url.pathname.slice(idx + marker.length);
                          const parts = tail.split('/');
                          const bucket = parts.shift()!;
                          const path = parts.join('/');
                          return { bucket, path };
                        } catch { return null; }
                      })();
                      if (parsed && alsoDelete) {
                        const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
                        if (error) alert(`Delete failed: ${error.message}`);
                      }
                      setDraft((d) => ({ ...d, video_url: '' }));
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
        )}

        {portfolioMode && (draft.media_type === 'image' || draft.media_type === 'gallery') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image URL */}
            <div>
              <Label htmlFor="image_url">Image URL</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id="image_url"
                  value={draft.image_url ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
                  placeholder="https://…/image.jpg"
                  className="flex-1"
                />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">Upload</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Upload image</DialogTitle>
                      <DialogDescription>Upload to the <code>images</code> bucket and autofill the URL.</DialogDescription>
                    </DialogHeader>
                    <ImageUploadCard
                      bucket="images"
                      folderPrefix="portfolio/"
                      onUploaded={(url) => {
                        setDraft((d) => ({ ...d, image_url: url }));
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {/* Live preview */}
              {draft.image_url ? (
                <div className="mt-3 rounded-md border p-2 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={String(draft.image_url)} alt="Image preview" className="max-h-64 w-auto rounded" />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(String(draft.image_url))}>Copy URL</Button>
                    <a href={String(draft.image_url)} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button size="sm" variant="outline">Open</Button>
                    </a>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Thumb URL */}
            <div>
              <Label htmlFor="thumb_url">Thumb URL (optional)</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id="thumb_url"
                  value={draft.thumb_url ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, thumb_url: e.target.value }))}
                  placeholder="https://…/thumb.jpg"
                  className="flex-1"
                />
                <Dialog>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline">Upload</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>Upload thumbnail</DialogTitle>
                      <DialogDescription>Upload to the <code>images</code> bucket and autofill the URL.</DialogDescription>
                    </DialogHeader>
                    <ImageUploadCard
                      bucket="images"
                      folderPrefix="portfolio/thumbs/"
                      onUploaded={(url) => {
                        setDraft((d) => ({ ...d, thumb_url: url }));
                      }}
                    />
                  </DialogContent>
                </Dialog>
              </div>

              {/* Preview */}
              {draft.thumb_url ? (
                <div className="mt-3 rounded-md border p-2 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={String(draft.thumb_url)} alt="Thumb preview" className="h-32 w-auto rounded" />
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(String(draft.thumb_url))}>Copy URL</Button>
                    <a href={String(draft.thumb_url)} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button size="sm" variant="outline">Open</Button>
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {portfolioMode && draft.media_type === 'link' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="site_url">Site URL</Label>
              <Input id="site_url" value={draft.site_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, site_url: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="external_url">External URL</Label>
              <Input id="external_url" value={draft.external_url ?? ''} onChange={(e) => setDraft((d) => ({ ...d, external_url: e.target.value }))} />
            </div>
          </div>
        )}

        {portfolioMode && draft.media_type === 'gallery' && (
          <div className="space-y-3">
            <Label>Gallery</Label>
            <GalleryUploadCard
              bucket="images"
              folderPrefix={`portfolio/${(draft.slug || 'gallery')}/`}
              value={((draft as any).gallery as GalleryItem[]) || []}
              onChange={(items) => setDraft((d) => ({ ...d, gallery: items } as any))}
            />
          </div>
        )}
        
        {portfolioMode && draft.media_type !== 'gallery' && (draft as any).gallery?.length ? (
          <div className="mt-2 text-xs text-muted-foreground">
            Gallery contains {(draft as any).gallery.length} images (only used when Media Type is “gallery”).
          </div>
        ) : null}

        {portfolioMode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                value={(draft.tags ?? []).join(',')}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))
                }
                placeholder="nextjs, supabase, ai"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="is_public">Public?</Label>
                <p className="text-xs text-muted-foreground">Only public items show on org pages.</p>
              </div>
              <Switch
                id="is_public"
                checked={draft.is_public ?? true}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, is_public: v }))}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="featured">Featured</Label>
              <p className="text-xs text-muted-foreground">Highlight on landing sections.</p>
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

/* ========================================================================== */
/* Page                                                                       */
/* ========================================================================== */

export default function ManageFeaturesPage() {
  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const currentOrg = useOrg(); // ← active org from the app

  // Portfolio mode + org slug
  const searchParams = useSearchParams();
  const searchOrg = (searchParams.get('org') || '').trim().toLowerCase();

  // drop-down list of orgs
  const [orgOptions, setOrgOptions] = React.useState<OrgOption[]>([]);

  // default org: ?org=… → current org → first option later
  const [orgSlug, setOrgSlug] = React.useState<string>(searchOrg || currentOrg.slug);
  const [portfolioMode, setPortfolioMode] = React.useState<boolean>(!!(searchOrg || currentOrg.slug));

  // auth state
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

  // load orgs for dropdown
  React.useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('organizations_public')
        .select('id, slug, name')
        .order('name');
      if (!error && data) {
        const opts = data as OrgOption[];
        setOrgOptions(opts);
        // if orgSlug is empty or not in list, default to current org or first
        const slugs = new Set(opts.map(o => o.slug));
        if (!orgSlug || !slugs.has(orgSlug)) {
          setOrgSlug(slugs.has(currentOrg.slug) ? currentOrg.slug : (opts[0]?.slug || ''));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rows, setRows] = React.useState<FeatureRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [search, setSearch] = React.useState('');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Partial<FeatureRow>>({});
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    void fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioMode, orgSlug]);

  async function fetchRows() {
    setLoading(true);
    if (portfolioMode && orgSlug) {
      const { data, error } = await supabase
        .from('features_public_portfolio')
        .select('*')
        .eq('org_slug', orgSlug)
        .order('featured', { ascending: false })
        .order('feature_order', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (!error && data) {
        setRows(data as FeatureRow[]);
        setLoading(false);
        return;
      }
      const fb = await supabase
        .from('features')
        .select('*')
        .order('featured', { ascending: false })
        .order('feature_order', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });
      if (!fb.error) setRows((fb.data ?? []) as FeatureRow[]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('features')
      .select('*')
      .order('featured', { ascending: false })
      .order('feature_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (!error) setRows((data || []) as FeatureRow[]);
    setLoading(false);
  }

  function startNew() {
    setSelectedId(null);
    setDraft({
      title: '',
      blurb: '',
      category: portfolioMode ? 'Web' : 'Editor',
      badge: '',
      doc_href: '',
      video_url: '',
      image_url: '',
      thumb_url: '',
      site_url: '',
      external_url: '',
      tags: [],
      featured: false,
      is_public: true,
      feature_order: null,
      slug: '',
      media_type: 'video',
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
      image_url: r.image_url ?? '',
      thumb_url: r.thumb_url ?? '',
      site_url: r.site_url ?? '',
      external_url: r.external_url ?? '',
      tags: r.tags ?? [],
      featured: !!r.featured,
      is_public: r.is_public ?? true,
      feature_order: r.feature_order ?? null,
      slug: r.slug ?? '',
      media_type: (r.media_type as MediaType) ?? 'video',
    });
  }

  async function onSave() {
    setSaving(true);
    try {
      if (!draft.title || !draft.blurb || !draft.category) {
        alert('Title, blurb, and category are required.');
        return;
      }
      if (portfolioMode) {
        if (!orgSlug) {
          alert('Select an org.');
          return;
        }
        if (!draft.slug) {
          alert('Portfolio item slug is required.');
          return;
        }

        const payload = {
          slug: draft.slug,
          payload: {
            title: draft.title,
            blurb: draft.blurb,
            category: draft.category,
            media_type: draft.media_type,
            video_url: draft.video_url || null,
            image_url: draft.image_url || null,
            thumb_url: draft.thumb_url || null,
            gallery: (draft as any).gallery ?? [],
            site_url: draft.site_url || null,
            external_url: draft.external_url || null,
            tags: (draft.tags ?? []).join(','),
            badge: draft.badge || null,
            featured: !!draft.featured,
            feature_order: draft.feature_order,
            is_public: draft.is_public ?? true,
          },
        };

        const res = await fetch(`/api/orgs/${orgSlug}/portfolio/upsert`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Save failed');
        await fetchRows();
        const saved = (json.data ?? {}) as FeatureRow;
        setSelectedId(saved.id ?? null);
      } else {
        const payload = {
          title: draft.title?.trim() ?? '',
          blurb: draft.blurb?.trim() ?? '',
          category: (draft.category as string) ?? 'Editor',
          badge: (draft.badge ?? '').trim() || null,
          doc_href: (draft.doc_href ?? '').trim() || null,
          video_url: (draft.video_url ?? '').trim() || null,
          featured: !!draft.featured,
          feature_order: draft.feature_order ?? null,
          ...(selectedId ? { id: selectedId } : {}),
        };
        const res = await fetch('/api/features/save', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Save failed');
        await fetchRows();
        setSelectedId((json.data as FeatureRow)?.id ?? null);
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedId) return;
    try {
      if (portfolioMode) {
        const { error } = await supabase.from('features').delete().eq('id', selectedId);
        if (error) throw error;
        await fetchRows();
        startNew();
      } else {
        const res = await fetch('/api/features/delete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ id: selectedId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'Delete failed');
        await fetchRows();
        startNew();
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Delete failed');
    }
  }

  async function onDuplicate() {
    if (!selectedId) return;
    const src = rows.find((r) => r.id === selectedId);
    if (!src) return;

    if (portfolioMode) {
      const dupSlug = `${(src.slug || 'copy')}-${Math.random().toString(36).slice(2, 6)}`.toLowerCase();
      const { error } = await supabase.from('features').insert({
        ...src,
        id: undefined,
        slug: dupSlug,
        title: `${src.title} (copy)`,
        feature_order: (src.feature_order ?? 0) + 1,
        created_at: undefined,
      } as any);
      if (error) alert(error.message);
      else await fetchRows();
      return;
    }

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

  React.useEffect(() => {
    if (!loading && !selectedId && rows.length > 0 && !draft.title) {
      startEdit(rows[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rows]);

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
              {portfolioMode ? 'Portfolio manager' : 'Manage features'}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
              {portfolioMode ? 'Portfolio manager' : 'Features manager'}
            </h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Portfolio mode</Label>
                <Switch
                  checked={portfolioMode}
                  onCheckedChange={(v) => {
                    setPortfolioMode(v);
                    if (v && !orgSlug) setOrgSlug(currentOrg.slug);
                  }}
                />
              </div>
              {portfolioMode && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Org</Label>
                  <Select value={orgSlug} onValueChange={setOrgSlug}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Select org" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgOptions.map((o) => (
                        <SelectItem key={o.id} value={o.slug}>
                          {o.name} — {o.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-muted-foreground">
            {portfolioMode
              ? <>Org-scoped uploads (videos, images, links). Choose an org. Public items appear on <code>/orgs/&lt;slug&gt;/portfolio</code>.</>
              : <>Edit existing demos on the left, fill the form on the right. Mark as <b>Featured</b> to appear on the homepage.</>}
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
        {/* Left: list */}
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
              <div className="py-8 text-center text-muted-foreground">No items yet.</div>
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
                        {portfolioMode && r.media_type ? (
                          <Badge variant="outline">{r.media_type}</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.blurb}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded bg-zinc-800 px-2 py-0.5">{r.category}</span>
                        <span className="rounded bg-zinc-800 px-2 py-0.5">Order: {r.feature_order ?? '—'}</span>
                        {portfolioMode && r.slug ? (
                          <span className="rounded bg-zinc-800 px-2 py-0.5">/{r.slug}</span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: form */}
        <FeatureForm
          draft={draft}
          setDraft={(u) => setDraft((prev) => u(prev))}
          onSave={onSave}
          onDelete={selectedId ? onDelete : undefined}
          onDuplicate={selectedId ? onDuplicate : undefined}
          saving={saving}
          isEditing={!!selectedId}
          authed={authed}
          portfolioMode={portfolioMode}
        />
      </section>

      {/* Footer link */}
      <div className="mx-auto max-w-6xl px-6 pb-8 text-sm text-muted-foreground">
        {portfolioMode ? (
          <>Tip: Public page is <Link href={`/orgs/${orgSlug || '{slug}'}/portfolio`} className="underline">/orgs/{orgSlug || 'slug'}/portfolio</Link>.</>
        ) : (
          <>Tip: Public page is <Link href="/features" className="underline">/features</Link>. Homepage shows <b>featured</b> items.</>
        )}
      </div>
    </div>
  );
}
