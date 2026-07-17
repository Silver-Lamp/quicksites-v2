// lib/authorSites/__tests__/importArtifacts.test.ts
//
// THE CONTRACT TEST for the author-commerce bridge: the fixture below is the
// VERBATIM prod-validated payload HiveJournal sent over crosstalk (2026-07-17,
// "The Flickering Screen", persona author Arlo V.) — if this test breaks, one
// side drifted from crosstalk/contracts/sellable-artifacts-export.md.

import { mapArtifactsToCatalogItems, type HjArtifactsPayload } from '../importArtifacts';

// Verbatim from crosstalk message 20260717-050917 (URLs HEAD-verified 200).
const PROD_PAYLOAD: HjArtifactsPayload = {
  work: {
    id: '805492fc-7ec9-4496-857b-07886ec81ed4',
    title: 'The Flickering Screen',
    author_name: 'Jordan K.',
  },
  artifacts: [
    {
      artifact_id: 'art_805492fc-7ec9-4496-857b-07886ec81ed4_paperback',
      type: 'paperback',
      provider: 'lulu',
      status: 'ready',
      title: 'The Flickering Screen',
      description:
        'In a dystopian society where every aspect of life is broadcast, a group of individuals begins questioning the authenticity of their existence. As they uncover layers of reality, they must decide whether to embrace their roles or rebel against the unseen forces controlling them.',
      cover_image_url:
        'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/posters/805492fc-7ec9-4496-857b-07886ec81ed4/1779472430662-n4pxlk.png',
      spec: {
        interiorUrl:
          'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/print/805492fc-7ec9-4496-857b-07886ec81ed4/export-interior.pdf',
        coverUrl:
          'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/print/805492fc-7ec9-4496-857b-07886ec81ed4/export-cover.pdf',
        pageCount: 40,
        podPackageId: '0600X0900BWSTDPB060UW444MXX',
      },
    },
    {
      artifact_id: 'art_805492fc-7ec9-4496-857b-07886ec81ed4_audiobook',
      type: 'audiobook',
      provider: 'digital',
      status: 'ready',
      title: 'The Flickering Screen',
      description:
        'In a dystopian society where every aspect of life is broadcast, a group of individuals begins questioning the authenticity of their existence. As they uncover layers of reality, they must decide whether to embrace their roles or rebel against the unseen forces controlling them.',
      cover_image_url:
        'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/posters/805492fc-7ec9-4496-857b-07886ec81ed4/1779472430662-n4pxlk.png',
      spec: {
        asset_url:
          'https://pfyocleyejmtxmbxrdcm.supabase.co/storage/v1/object/public/season-assets/audio/805492fc-7ec9-4496-857b-07886ec81ed4/book-full.mp3',
      },
    },
  ],
};

const OPTS = { merchantId: 'merch-demo', siteSlug: 'arlo-v-books' };

describe('mapArtifactsToCatalogItems — HJ prod payload dry-run', () => {
  it('maps the paperback to a Lulu POD catalog item, spec keys verbatim', () => {
    const { rows } = mapArtifactsToCatalogItems(PROD_PAYLOAD, OPTS);
    const pb = rows.find((r) => r.metadata.fulfillment_provider === 'lulu')!;
    expect(pb).toBeTruthy();
    expect(pb.type).toBe('product');
    expect(pb.title).toBe('The Flickering Screen');
    expect(pb.merchant_id).toBe('merch-demo');
    // Exact pod_spec pass-through — what lib/commerce/pod/fulfillment.ts reads.
    expect(pb.metadata.pod_spec).toEqual(PROD_PAYLOAD.artifacts[0].spec);
    // The binding upsert key.
    expect(pb.metadata.hj_artifact_id).toBe('art_805492fc-7ec9-4496-857b-07886ec81ed4_paperback');
    // No HJ price snapshot → honest default + review flag (nothing sells unconfirmed).
    expect(pb.price_cents).toBe(1499);
    expect(pb.metadata.price_needs_review).toBe(true);
    expect(pb.images).toEqual([PROD_PAYLOAD.artifacts[0].cover_image_url]);
  });

  it('maps the audiobook to a digital item with the permanent asset url', () => {
    const { rows } = mapArtifactsToCatalogItems(PROD_PAYLOAD, OPTS);
    const ab = rows.find((r) => r.type === 'digital')!;
    expect(ab).toBeTruthy();
    expect(ab.metadata.digital_asset_url).toBe(PROD_PAYLOAD.artifacts[1].spec!.asset_url);
    expect(ab.metadata.hj_artifact_id).toBe('art_805492fc-7ec9-4496-857b-07886ec81ed4_audiobook');
    expect(ab.metadata.fulfillment_provider).toBeUndefined(); // digital ≠ POD
    expect(ab.price_cents).toBe(999);
    expect(ab.metadata.price_needs_review).toBe(true);
  });

  it('routes the other two contract states correctly (preparing → re-poll, failed → retry)', () => {
    const withStates: HjArtifactsPayload = {
      ...PROD_PAYLOAD,
      artifacts: [
        ...PROD_PAYLOAD.artifacts,
        { artifact_id: 'art_x_merch', type: 'merch', provider: 'gelato', status: 'preparing', pending: true },
        { artifact_id: 'art_x_poster', type: 'merch', provider: 'gelato', status: 'failed', error: 'render died', retry_ok: true },
      ],
    };
    const r = mapArtifactsToCatalogItems(withStates, OPTS);
    expect(r.rows).toHaveLength(2); // only ready maps
    expect(r.preparing.map((a) => a.artifact_id)).toEqual(['art_x_merch']);
    expect(r.failed.map((a) => a.artifact_id)).toEqual(['art_x_poster']);
    expect(r.failed[0].retry_ok).toBe(true);
    expect(r.skipped).toHaveLength(0);
  });

  it('skips (never half-imports) artifacts with contract violations', () => {
    const broken: HjArtifactsPayload = {
      ...PROD_PAYLOAD,
      artifacts: [
        { ...PROD_PAYLOAD.artifacts[0], spec: { interiorUrl: 'https://x/interior.pdf' } }, // missing cover/pageCount
        { artifact_id: '', type: 'paperback', provider: 'lulu', status: 'ready' } as any, // no id
      ],
    };
    const r = mapArtifactsToCatalogItems(broken, OPTS);
    expect(r.rows).toHaveLength(0);
    expect(r.skipped.map((s) => s.reason)).toEqual([
      'incomplete lulu spec',
      'no artifact_id (contract violation)',
    ]);
  });

  it('suggested_price_cents, when present, wins and clears the review flag', () => {
    const priced: HjArtifactsPayload = {
      ...PROD_PAYLOAD,
      artifacts: [{ ...PROD_PAYLOAD.artifacts[0], suggested_price_cents: 1899 }],
    };
    const { rows } = mapArtifactsToCatalogItems(priced, OPTS);
    expect(rows[0].price_cents).toBe(1899);
    expect(rows[0].metadata.price_needs_review).toBeUndefined();
  });
});
