'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import type { Template } from '@/types/template';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

export type BlockEditorProps = {
  block: Block;
  onSave: (updated: Block) => void;
  onClose: () => void;
  errors?: Record<string, BlockValidationError[]>;
  template: Template;
  fullBleed?: boolean;
};

/* ============================ Event helpers ============================ */

function emitApplyPatch(patch: Partial<Template>) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:apply-patch', { detail: patch as any }));
  } catch {}
}
function emitMerge(detail: any) {
  try {
    window.dispatchEvent(new CustomEvent('qs:template:merge', { detail }));
  } catch {}
}

/* ======================== Block merge (central) ======================== */

type AnyObj = Record<string, any>;

// ...top of file unchanged...

/**
 * Replace a block (matched by _id/id) across ANY known blocks array shape on a page:
 * - page.blocks
 * - page.content_blocks
 * - page.content.blocks
 *
 * Returns a new `data` object if something changed; otherwise undefined.
 */
function replaceBlockInTemplateData(template: Template, updated: Block): AnyObj | undefined {
  const t: AnyObj = template as any;
  const data: AnyObj = t.data ?? {};
  const pagesIn: AnyObj[] = Array.isArray(data.pages) ? data.pages : (Array.isArray(t.pages) ? t.pages : []);
  if (!Array.isArray(pagesIn) || pagesIn.length === 0) return undefined;

  const targetId = (updated as any)._id ?? (updated as any).id;
  if (!targetId) return undefined;

  let anyPageChanged = false;

  const pagesOut = pagesIn.map((p) => {
    const arrays: Array<{ kind: 'blocks' | 'content_blocks' | 'content.blocks'; arr: AnyObj[] }> = [];
    if (Array.isArray(p.blocks)) arrays.push({ kind: 'blocks', arr: p.blocks });
    if (Array.isArray(p.content_blocks)) arrays.push({ kind: 'content_blocks', arr: p.content_blocks });
    if (Array.isArray(p?.content?.blocks)) arrays.push({ kind: 'content.blocks', arr: p.content.blocks });

    if (arrays.length === 0) return p;

    let pageChanged = false;
    const nextByKind: Partial<Record<'blocks' | 'content_blocks' | 'content.blocks', AnyObj[]>> = {};

    for (const { kind, arr } of arrays) {
      let touched = false;
      const next = arr.map((b) => {
        const bid = b?._id ?? b?.id;
        if (bid && bid === targetId) { touched = true; return updated; }
        return b;
      });
      if (touched) { nextByKind[kind] = next; pageChanged = true; }
    }

    if (!pageChanged) return p;

    let nextPage: AnyObj = { ...p };
    if (nextByKind['blocks']) nextPage.blocks = nextByKind['blocks'];
    if (nextByKind['content_blocks']) nextPage.content_blocks = nextByKind['content_blocks'];
    if (nextByKind['content.blocks']) nextPage.content = { ...(nextPage.content ?? {}), blocks: nextByKind['content.blocks'] };
    anyPageChanged = true;
    return nextPage;
  });

  if (!anyPageChanged) return undefined;

  const meta = { ...(data.meta ?? {}) };
  const services =
    Array.isArray(data.services) ? data.services :
    Array.isArray(meta.services) ? meta.services :
    undefined;

  return { ...data, pages: pagesOut, meta, ...(services ? { services } : {}) };
}


/**
 * Wrap an editor so its onSave centrally merges the updated block into the
 * working template and emits a canonical data patch.
 */
function wrapEditorComponent(EditorComp: React.ComponentType<BlockEditorProps>): React.ComponentType<BlockEditorProps> {
  const Wrapped: React.FC<BlockEditorProps> = (props) => {
    const { template, onSave } = props;

    const wrappedSave = React.useCallback(
      (updated: Block) => {
        try {
          const nextData = replaceBlockInTemplateData(template, updated);
          if (nextData) {
            const patch: Partial<Template> = { data: nextData };
            // Fast local reflection and working copy update
            emitMerge({ data: nextData });
            emitApplyPatch(patch);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[block-editor wrapper] merge/apply failed:', e);
        }
        // Allow upstream handlers (modal close, etc.) to proceed
        onSave(updated);
      },
      [template, onSave]
    );

    // No JSX here (file is .ts) → avoid ts(2749)
    return React.createElement(EditorComp, { ...(props as any), onSave: wrappedSave });
  };

  Wrapped.displayName = `WrappedBlockEditor(${(EditorComp as any).displayName || EditorComp.name || 'Editor'})`;
  return Wrapped;
}

/** Wrap a dynamic import so we return the wrapped component */
type EditorModule = { default: React.ComponentType<BlockEditorProps> };
function wrapDynamic(loader: () => Promise<EditorModule>): () => Promise<EditorModule> {
  return async () => {
    const mod = await loader();
    const Comp = mod.default;
    return { default: wrapEditorComponent(Comp) };
  };
}

/* =================== Mapping of block type → editor ==================== */

export const BLOCK_EDITORS: Record<Block['type'], () => Promise<EditorModule>> = {
  text: wrapDynamic(() => import('./text-editor')),
  image: wrapDynamic(() => import('./image-editor')),
  video: wrapDynamic(() => import('./video-editor')),
  audio: wrapDynamic(() => import('./audio-editor')),
  quote: wrapDynamic(() => import('./quote-editor')),
  button: wrapDynamic(() => import('./button-editor')),
  grid: wrapDynamic(() => import('./json-fallback-editor')), // uses JSON fallback
  hero: wrapDynamic(() => import('./hero-editor')),
  services: wrapDynamic(() => import('./services-editor')),
  testimonial: wrapDynamic(() => import('./testimonial-editor')),
  cta: wrapDynamic(() => import('./cta-editor')),
  footer: wrapDynamic(() => import('./footer-editor')),
  service_areas: wrapDynamic(() => import('./service-areas-editor')),
  header: wrapDynamic(() => import('./header-editor')),
  faq: wrapDynamic(() => import('./faq-editor')),
  contact_form: wrapDynamic(async () => {
    const mod = await import('./contact-form-editor');
    return { default: mod.ContactFormEditor };
  }),
  meal_card: wrapDynamic(() => import('./meal-card-editor')),
  chef_profile: wrapDynamic(() => import('./chef-profile-editor')),
};

/* ============================ Preload helpers ========================== */

export function preloadBlockEditor(type: Block['type']) {
  if (type in BLOCK_EDITORS) {
    void BLOCK_EDITORS[type]();
  }
}

export function preloadCommonEditors() {
  preloadBlockEditor('hero');
  preloadBlockEditor('text');
  preloadBlockEditor('cta');
  preloadBlockEditor('faq');
}
