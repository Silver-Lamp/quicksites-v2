// app/admin/templates/new/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Template } from '@/types/template';
import { createEmptyTemplate } from '@/lib/createEmptyTemplate';
import { toast } from 'react-hot-toast';

/** Fallback local slug generator */
function generateLocalSlug(base = 'new-template') {
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Try Supabase RPC for a unique template slug, fallback to local */
async function getUniqueTemplateSlug(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_unique_template_name');
  if (error || !data) {
    console.warn('[RPC fallback] generate_unique_template_name failed:', error?.message);
    return generateLocalSlug();
  }
  return data;
}

/* ---------------- helpers ---------------- */
function safeParse(x: unknown) {
  if (typeof x !== 'string') return (x as any) ?? {};
  try { return JSON.parse(x); } catch { return {}; }
}
function coalescePages(obj: any): any[] {
  if (Array.isArray(obj?.data?.pages)) return obj.data.pages;
  if (Array.isArray(obj?.pages)) return obj.pages;
  return [];
}
function withSyncedPages<T extends { data?: any; pages?: any[] }>(tpl: T): T {
  const pages = coalescePages(tpl);
  return { ...tpl, pages, data: { ...(tpl.data ?? {}), pages } } as T;
}
/**
 * Insert a new draft template row and return the inserted id (or null).
 * Expects canonical data in `initial.data` (headerBlock/footerBlock inside data if present).
 */
async function insertDraft(initial: Template): Promise<string | null> {
  const payload: any = {
    template_name: initial.template_name ?? initial.slug ?? 'Untitled',
    slug: initial.slug,
    base_slug: initial.slug,              // adjust if you use a different base logic
    data: initial.data ?? {},
    is_version: false,
    is_site: initial.is_site ?? false,
    published: false,
    color_mode: initial.color_mode ?? initial.data?.color_mode ?? 'light',
    header_block: initial.data?.headerBlock ?? null,
    footer_block: initial.data?.footerBlock ?? null,
    domain: initial.domain ?? null,
    default_subdomain: initial.default_subdomain ?? null,
  };

  const { data, error } = await supabase
    .from('templates')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('[new template] insert failed:', error.message);
    return null;
  }
  return data?.id ?? null;
}
/* ---------------------------------------- */

export default function NewTemplatePage() {
  const searchParams = useSearchParams();
  const from = searchParams?.get('from') ?? ''; // optional snapshot id

  const [initialData, setInitialData] = useState<Template | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initializeTemplate() {
      setBusy(true);
      try {
        const slug = await getUniqueTemplateSlug();

        // START with a fresh shell
        const fresh = withSyncedPages(createEmptyTemplate(slug) as Template);

        // If remixing from a snapshot, copy content + a few attrs
        let base: Template = fresh;
        if (from) {
          const { data: snapshot, error } = await supabase
            .from('snapshots')
            .select('data, hash, created_at')
            .eq('id', from)
            .maybeSingle();

          if (error || !snapshot) {
            console.warn('[new template] could not load snapshot:', error?.message);
          } else {
            const snapData = safeParse(snapshot.data);
            base = withSyncedPages({
              ...fresh,
              data: {
                // keep any default meta the shell creates and layer snapshot
                ...(fresh.data ?? {}),
                ...(snapData ?? {}),
                // be explicit which fields we want to carry:
                services: Array.isArray(snapData?.services) ? snapData.services : (fresh.data?.services ?? []),
                pages: Array.isArray(snapData?.pages) ? snapData.pages : (fresh.data?.pages ?? []),
              },
              is_site: !!snapData?.is_site || false,
              color_mode: (snapData?.color_mode as 'light' | 'dark') ?? (fresh.color_mode as any) ?? 'light',
            } as Template);

            // optional analytics: log a remix event if authenticated
            try {
              const { data: auth } = await supabase.auth.getUser();
              if (auth?.user?.id) {
                await supabase.from('remix_events').insert([
                  { original_snapshot_id: from, user_id: auth.user.id },
                ]);
              }
            } catch {}
          }
        }

        // Ensure chrome is mirrored inside data (renderer/editor expect it there)
        if (!base.data?.headerBlock && (base as any).headerBlock) {
          base.data!.headerBlock = (base as any).headerBlock;
        }
        if (!base.data?.footerBlock && (base as any).footerBlock) {
          base.data!.footerBlock = (base as any).footerBlock;
        }
        if (!base.data?.color_mode && base.color_mode) {
          base.data!.color_mode = base.color_mode;
        }

        // Create the draft row so the editor has an ID for commits
        const insertedId = await insertDraft(base);
        if (!insertedId) {
          toast.error('Failed to create draft template.');
          if (!cancelled) setInitialData(null);
          return;
        }

        const withId: Template = { ...base, id: insertedId } as Template;
        if (!cancelled) setInitialData(withSyncedPages(withId));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void initializeTemplate();
    return () => { cancelled = true; };
  }, [from]);

  if (busy || !initialData) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-pulse text-white/60 bg-neutral-800 px-6 py-4 rounded shadow border border-neutral-700">
          {busy ? 'Preparing your new template…' : 'No template initialized.'}
        </div>
      </div>
    );
  }

  const colorMode = (initialData.color_mode as 'light' | 'dark') ?? 'light';

  return (
    <TemplateEditor
      templateName={initialData.template_name || initialData.slug || 'Untitled'}
      initialData={initialData}
      initialMode={initialData.is_site ? 'site' : 'template'}
      colorMode={colorMode}
    />
  );
}
