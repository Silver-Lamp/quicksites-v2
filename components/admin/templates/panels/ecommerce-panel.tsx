'use client';

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { ProductManagerModal } from '@/components/admin/ecommerce/product-manager-modal';
import type { Template } from '@/types/template';

type Props = {
  templateId?: string | null;
  /** Pass the active page slug or id if you track it; we’ll also fall back to ?page=... or first page. */
  currentPageId?: string;
  template?: Template;
};

export default function EcommercePanel({ templateId, currentPageId, template }: Props) {
  const [open, setOpen] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [merchantEmail, setMerchantEmail] = React.useState<string>(
    (typeof window !== 'undefined' && localStorage.getItem('merchant_email')) || ''
  );

  React.useEffect(() => {
    if (merchantEmail) localStorage.setItem('merchant_email', merchantEmail);
  }, [merchantEmail]);

  // Insert a Products Grid block with selected product ids
  const insertProductsGrid = React.useCallback((productIds: string[], title = 'Featured Products') => {
    try {
      if (!Array.isArray(productIds)) productIds = [];
      // Read current template draft from global refs used by the editor/toolbar
      const tpl: any =
        (window as any).__QS_TPL_REF__?.current ??
        (window as any).__QS_TEMPLATE__ ??
        null;

      const pages: any[] =
        (Array.isArray(tpl?.data?.pages) && tpl.data.pages) ||
        (Array.isArray(tpl?.pages) && tpl.pages) ||
        [];

      if (!pages.length) return;

      // Resolve active page: prefer prop, else ?page=… slug, else first page
      let idx = -1;
      if (currentPageId) {
        idx = pages.findIndex(
          (p: any) => p?.slug === currentPageId || p?.id === currentPageId
        );
      }
      if (idx < 0) {
        const sp = new URLSearchParams(location.search);
        const qSlug = sp.get('page');
        if (qSlug) idx = pages.findIndex((p: any) => p?.slug === qSlug);
      }
      if (idx < 0) idx = 0;

      const page = { ...pages[idx] };

      const existingBlocks: any[] =
        (Array.isArray(page?.blocks) && page.blocks) ||
        (Array.isArray(page?.content_blocks) && page.content_blocks) ||
        (Array.isArray(page?.content?.blocks) && page.content.blocks) ||
        [];

      const newBlock = {
        _id: crypto.randomUUID(),
        type: 'products_grid', // renderer listens to this
        content: {
          section_title: title,
          title,
          columns: 3,
          product_ids: productIds,   // canonical
          productIds: productIds,    // legacy camelCase (kept for back-compat)
        },
      };

      const nextBlocks = [...existingBlocks, newBlock];

      const nextPage: any = {
        ...page,
        blocks: nextBlocks,
        ...(Array.isArray(page?.content_blocks) ? { content_blocks: nextBlocks } : {}),
        ...(page?.content && typeof page.content === 'object'
          ? { content: { ...page.content, blocks: nextBlocks } }
          : {}),
      };

      const nextPages = [...pages];
      nextPages[idx] = nextPage;

      const nextData = { ...(tpl?.data ?? {}), pages: nextPages };

      // Apply patch to the editor, then ask toolbar to persist
      window.dispatchEvent(
        new CustomEvent('qs:template:apply-patch', { detail: { data: nextData } })
      );
      window.dispatchEvent(new Event('qs:toolbar:save-now'));
    } catch {
      // swallow — UI already provides manual save/edit paths
    }
  }, [currentPageId]);

  return (
    <>
      <Collapsible title="E-commerce" defaultOpen={open} onOpenChange={setOpen}>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="merchantEmail">Merchant user email</Label>
            <Input
              id="merchantEmail"
              value={merchantEmail}
              onChange={(e) => setMerchantEmail(e.target.value)}
              placeholder="merchant.demo@example.com"
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              We use this to list and create products for the connected merchant.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Manage products &amp; services…
            </Button>
          </div>
        </div>
      </Collapsible>

      <ProductManagerModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        merchantEmail={merchantEmail}
        onMerchantEmailChange={setMerchantEmail}
        onInsertGrid={(ids, title) => insertProductsGrid(ids, title)}
        templateId={templateId}
        // richer hints improve AI suggestions
        industryHint={
          (template as any)?.data?.meta?.industry ??
          (template as any)?.industry ??
          'other'
        }
        cityHint={
          (template as any)?.data?.meta?.contact?.city ??
          (template as any)?.data?.meta?.city ??
          null
        }
        stateHint={
          (template as any)?.data?.meta?.contact?.state ??
          (template as any)?.data?.meta?.state ??
          null
        }
        currency="USD"
      />
    </>
  );
}
