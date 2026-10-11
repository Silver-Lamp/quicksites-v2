// lib/outreach/draftLinks.ts
//
// The outreach links a listing-import draft carries on the templates list (owner, 2026-10-10:
// "see the Evolve template site and the postcards, etc, from these rows like what shows on the
// restaurants-without-online-ordering page"). Pure: the list API resolves the draft's prospect
// and mints the claim token; this decides which links exist and where they point, so the row
// on /admin/templates/list and the row on /admin/restaurants/no-ordering cannot disagree.
//
// ⚠️ Evolve needs a CURRENT SITE to sit beside — it is the "your site stays, add ordering"
// pitch — so a draft whose prospect has no website gets no Evolve link, and a draft with no
// prospect at all (a post build: River, Michelle) gets only the preview and the claim link.

export type DraftProspect = {
  id: string;
  website: string | null;
  ordering_platform?: string | null;
  postcard_sent_at?: string | null;
  claim_link_visits?: number | null;
  claim_link_visited_at?: string | null;
  claimed_at?: string | null;
};

export type DraftOutreachLinks = {
  previewUrl: string;
  claimUrl: string;
  evolveUrl: string | null;
  cardFrontUrl: string | null;
  cardBackUrl: string | null;
  /** One short status line for the row, or null when nothing has happened yet. */
  status: string | null;
  builtFromPost: boolean;
};

export function draftOutreachLinks(input: {
  templateId: string;
  slug: string | null;
  claimSource: string | null;
  builtFromPost: boolean;
  prospect: DraftProspect | null;
  claimToken: string;
  base: string;
  menuHost: string | null;
}): DraftOutreachLinks | null {
  if (input.claimSource !== 'listing_import' || !input.slug) return null;
  const base = input.base.replace(/\/+$/, '');
  const p = input.prospect;
  const hasSite = !!p?.website;
  const parts: string[] = [];
  if (p?.postcard_sent_at) parts.push(`card mailed ${fmt(p.postcard_sent_at)}`);
  if ((p?.claim_link_visits ?? 0) > 0) parts.push(`link opened ${p!.claim_link_visits}×${p?.claim_link_visited_at ? ` (last ${fmt(p.claim_link_visited_at)})` : ''}`);
  if (p?.claimed_at) parts.push(`claimed ${fmt(p.claimed_at)}`);
  return {
    // A food draft is shown on the menu host; anything else on the platform path.
    previewUrl: input.menuHost && !input.builtFromPost ? `https://deliveredmenu.com/${input.slug}` : `${base}/sites/${input.slug}`,
    claimUrl: `${base}/claim-site/${input.templateId}?token=${encodeURIComponent(input.claimToken)}`,
    evolveUrl: p && hasSite ? `${base}/evolve/${p.id}` : null,
    cardFrontUrl: p && hasSite ? `/api/admin/prospects/evolve-postcard/${p.id}?side=front` : null,
    cardBackUrl: p && hasSite ? `/api/admin/prospects/evolve-postcard/${p.id}?side=back` : null,
    status: parts.length ? parts.join(' · ') : null,
    builtFromPost: input.builtFromPost,
  };
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '?' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
