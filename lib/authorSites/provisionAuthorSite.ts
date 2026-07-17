// lib/authorSites/provisionAuthorSite.ts
//
// The QS build item for HJ Author Sites (crosstalk ideas.md §1 prereq #3): given a
// verified handoff payload + the now-authenticated author, provision a reseller-
// branded author storefront under HJ's QS org. Reuses the reseller org's `org_id`
// (branding + commission rails), the shared scaffold (buildAuthorStorefront), and
// the artifact mapper (#481) when a payload is available.
//
// The sellable-artifacts export GET is authed with the author's HJ owner token
// (contract: "HJ owner token (v1) → partner API key when the provisioning API
// ships"), so QS can't fetch the catalog server-to-server at provision time. This
// therefore provisions the SHELL — the branded site + merchant, stamped
// `import_pending` + `hj_work_id` — and imports the catalog only when a payload is
// handed in (a later authenticated import step upserts on metadata.hj_artifact_id,
// exactly the mapper's contract, so the shell fills in without re-provisioning).
//
// Idempotent per (org, work_id): a leaked/replayed token can't double-provision.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { mapArtifactsToCatalogItems, type HjArtifactsPayload } from '@/lib/authorSites/importArtifacts';
import { buildAuthorStorefront } from '@/lib/authorSites/buildAuthorStorefront';
import type { AuthorHandoffPayload } from '@/lib/authorSites/handoffToken';

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'author';

export type ProvisionResult =
  | { ok: true; status: 'created' | 'exists'; templateId: string; slug: string; merchantId?: string; items: number }
  | { ok: false; error: string };

export async function provisionAuthorSite(opts: {
  payload: AuthorHandoffPayload;
  ownerId: string;
  /** Optional catalog snapshot; when omitted the site provisions as a pending-import shell. */
  artifacts?: HjArtifactsPayload;
}): Promise<ProvisionResult> {
  const { payload, ownerId, artifacts } = opts;
  const db = supabaseAdmin as any;

  try {
    // 1) The reseller org the site is branded under. Only a real reseller org qualifies.
    const { data: org } = await db
      .from('organizations')
      .select('id, billing_mode')
      .eq('slug', payload.org)
      .maybeSingle();
    if (!org?.id) return { ok: false, error: `unknown org "${payload.org}"` };
    if (org.billing_mode !== 'reseller') return { ok: false, error: `org "${payload.org}" is not a reseller` };

    const authorName = payload.authorName?.trim() || 'Author';
    const workTitle = payload.workTitle?.trim() || 'their book';

    // 2) Idempotency: one site per (org, work). A replayed token returns the same site.
    const { data: existing } = await db
      .from('templates')
      .select('id, slug')
      .eq('org_id', org.id)
      .eq('data->meta->>hj_work_id', payload.workId)
      .maybeSingle();
    if (existing?.id) {
      return { ok: true, status: 'exists', templateId: existing.id, slug: existing.slug, items: 0 };
    }

    const slug = `${slugify(authorName)}-books-${payload.workId.slice(-6)}`;

    // 3) Dedicated merchant owned by the author (never an existing store).
    const { data: merchant, error: mErr } = await db
      .from('merchants')
      .insert({
        owner_id: ownerId,
        user_id: ownerId,
        display_name: `${authorName} — Author`,
        site_slug: slug,
        default_currency: 'USD',
      })
      .select('id')
      .single();
    if (mErr || !merchant?.id) return { ok: false, error: `merchant insert failed: ${mErr?.message}` };

    // 4) Import the catalog when a snapshot was handed in; else leave a pending shell.
    const itemIds: string[] = [];
    let priceReview = 0;
    if (artifacts) {
      const mapped = mapArtifactsToCatalogItems(artifacts, { merchantId: merchant.id, siteSlug: slug });
      for (const row of mapped.rows) {
        const { data: created, error: iErr } = await db.from('catalog_items').insert(row).select('id').single();
        if (iErr || !created?.id) return { ok: false, error: `item insert failed: ${iErr?.message}` };
        itemIds.push(created.id as string);
      }
      priceReview = mapped.rows.filter((r) => r.metadata.price_needs_review).length;
    }

    // 5) The branded storefront. Not published — the author confirms prices first
    //    (imported items are stamped price_needs_review), same posture as menu confirm.
    const storefront = buildAuthorStorefront({
      authorName,
      workTitle,
      slug,
      merchantId: merchant.id,
      itemIds,
      extraMeta: {
        hj_work_id: payload.workId,
        author_site: true,
        reseller_org_slug: payload.org,
        ...(artifacts ? { price_review_count: priceReview } : { import_pending: true }),
      },
    });

    const { data: inserted, error: tErr } = await db
      .from('templates')
      .insert({
        template_name: `${authorName} — Author`,
        slug,
        data: storefront.data,
        color_mode: storefront.colorMode,
        header_block: storefront.headerBlock,
        footer_block: storefront.footerBlock,
        is_site: true,
        industry: 'author',
        business_name: authorName,
        owner_id: ownerId,
        org_id: org.id,
      })
      .select('id')
      .single();
    if (tErr || !inserted?.id) return { ok: false, error: `template insert failed: ${tErr?.message}` };

    return { ok: true, status: 'created', templateId: inserted.id, slug, merchantId: merchant.id, items: itemIds.length };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
