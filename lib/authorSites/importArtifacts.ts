// lib/authorSites/importArtifacts.ts
//
// The QS half of the author-commerce bridge (crosstalk/contracts/
// sellable-artifacts-export.md, Status: AGREED): map HiveJournal's sellable-
// artifacts payload into `catalog_items` rows. Pure — the caller supplies the
// merchant and does the writes, so the mapper is contract-testable against real
// HJ payloads with no DB.
//
// Contract behaviors implemented here:
//  - UPSERT KEY: metadata.hj_artifact_id (stable across re-renders; binding req).
//  - Only `status: 'ready'` artifacts map (absent status = legacy-ready).
//    'preparing' → the caller should re-poll; 'failed' → surface with retry.
//  - paperback/merch → metadata.fulfillment_provider + metadata.pod_spec
//    (exact lulu/gelato spec keys pass through); audiobook → type 'digital'
//    with the permanent asset_url in metadata.
//  - Pricing: suggested_price_cents when present; otherwise an honest default
//    stamped metadata.price_needs_review=true so the import UI makes the author
//    confirm before publishing the catalog (same posture as menu price confirm).

export type HjArtifact = {
  artifact_id: string;
  type: 'paperback' | 'merch' | 'audiobook' | string;
  provider: 'lulu' | 'gelato' | 'digital' | string;
  status?: 'ready' | 'preparing' | 'failed' | string;
  pending?: boolean;
  error?: string;
  retry_ok?: boolean;
  title?: string;
  description?: string;
  cover_image_url?: string;
  suggested_price_cents?: number;
  spec?: Record<string, any>;
};

export type HjArtifactsPayload = {
  work: { id: string; title: string; author_name?: string };
  artifacts: HjArtifact[];
};

export type CatalogItemRow = {
  merchant_id: string;
  type: 'product' | 'digital';
  title: string;
  slug: string;
  description: string;
  price_cents: number;
  images: string[];
  status: 'active';
  metadata: Record<string, any>;
};

export type ImportMapResult = {
  rows: CatalogItemRow[];
  /** Artifacts still rendering — caller should POST prepare (idempotent) + re-poll. */
  preparing: HjArtifact[];
  /** Terminal failures — surface with a retry affordance (re-POST prepare). */
  failed: HjArtifact[];
  skipped: Array<{ artifact_id: string; reason: string }>;
};

// Honest defaults when HJ has no price snapshot (export-rendered assets carry no
// Lulu quote): stamped price_needs_review so nothing sells unconfirmed.
const DEFAULT_PRICE_CENTS: Record<string, number> = {
  paperback: 1499,
  audiobook: 999,
  merch: 2500,
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'item';

export function mapArtifactsToCatalogItems(
  payload: HjArtifactsPayload,
  opts: { merchantId: string; siteSlug: string },
): ImportMapResult {
  const rows: CatalogItemRow[] = [];
  const preparing: HjArtifact[] = [];
  const failed: HjArtifact[] = [];
  const skipped: ImportMapResult['skipped'] = [];

  for (const a of payload?.artifacts ?? []) {
    if (!a?.artifact_id) {
      skipped.push({ artifact_id: '(missing)', reason: 'no artifact_id (contract violation)' });
      continue;
    }
    const status = a.status ?? (a.pending ? 'preparing' : 'ready'); // legacy shapes tolerated
    if (status === 'preparing') { preparing.push(a); continue; }
    if (status === 'failed') { failed.push(a); continue; }
    if (status !== 'ready') { skipped.push({ artifact_id: a.artifact_id, reason: `unknown status "${status}"` }); continue; }

    const title = (a.title || payload.work?.title || 'Untitled').trim();
    const hasPrice = typeof a.suggested_price_cents === 'number' && a.suggested_price_cents > 0;
    const priceCents = hasPrice ? a.suggested_price_cents! : (DEFAULT_PRICE_CENTS[a.type] ?? 999);

    const metadata: Record<string, any> = {
      site_slug: opts.siteSlug,
      hj_artifact_id: a.artifact_id, // the UPSERT key (binding contract requirement)
      hj_work_id: payload.work?.id ?? null,
      ...(hasPrice ? {} : { price_needs_review: true }),
    };

    if (a.type === 'audiobook' || a.provider === 'digital') {
      const assetUrl = a.spec?.asset_url;
      if (typeof assetUrl !== 'string' || !assetUrl) {
        skipped.push({ artifact_id: a.artifact_id, reason: 'digital artifact missing spec.asset_url' });
        continue;
      }
      metadata.digital_asset_url = assetUrl; // permanent + unsigned per contract
      rows.push({
        merchant_id: opts.merchantId,
        type: 'digital',
        title,
        slug: `${slugify(title)}-audiobook-${a.artifact_id.slice(-6)}`,
        description: a.description || '',
        price_cents: priceCents,
        images: a.cover_image_url ? [a.cover_image_url] : [],
        status: 'active',
        metadata,
      });
      continue;
    }

    if (a.provider === 'lulu' || a.provider === 'gelato') {
      const spec = a.spec ?? {};
      const specOk =
        a.provider === 'lulu'
          ? typeof spec.interiorUrl === 'string' && typeof spec.coverUrl === 'string' && Number(spec.pageCount) > 0
          : typeof spec.productUid === 'string' && typeof spec.fileUrl === 'string';
      if (!specOk) {
        skipped.push({ artifact_id: a.artifact_id, reason: `incomplete ${a.provider} spec` });
        continue;
      }
      metadata.fulfillment_provider = a.provider;
      metadata.pod_spec = { ...spec }; // exact key pass-through per contract
      rows.push({
        merchant_id: opts.merchantId,
        type: 'product',
        title,
        slug: `${slugify(title)}-${a.type}-${a.artifact_id.slice(-6)}`,
        description: a.description || '',
        price_cents: priceCents,
        images: a.cover_image_url ? [a.cover_image_url] : [],
        status: 'active',
        metadata,
      });
      continue;
    }

    skipped.push({ artifact_id: a.artifact_id, reason: `unknown provider "${a.provider}"` });
  }

  return { rows, preparing, failed, skipped };
}
