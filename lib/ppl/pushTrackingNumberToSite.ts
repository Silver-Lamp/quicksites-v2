// lib/ppl/pushTrackingNumberToSite.ts
//
// PUT THE TRACKING NUMBER ON THE SITE THAT IS SUPPOSED TO PRODUCE THE CALLS.
//
// ⚠️ WITHOUT THIS, BUYING A NUMBER ACCOMPLISHES NOTHING AND EVERY SIGNAL SAYS IT WORKED.
// Provisioning wires Twilio, saves `forward_to`, and texts the business — all of which return
// success — while the page a caller actually sees keeps advertising whatever phone it had.
// `southhilltowing.com` (2026-09-28, the first real purchase) went on showing (360) 458-2555
// after +1 253 655 2016 was bought for it. The consequences compound in the wrong direction:
// calls go somewhere untracked, the campaign reads "0 calls", the market looks dead and gets
// written off — and the business we just texted "calls are being forwarded to you" gets none.
//
// ⚠️ EDITS PHONE FIELDS BY NAME, never "strings that look like a phone". A number-shaped string
// in prose ("serving 253 homes since 1998") is copy, not a contact field, and rewriting it would
// quietly edit what a site says.
//
// ⚠️ WALKS THE WHOLE TREE (CLAUDE.md §8). The same contact lives in `meta.contact`,
// `identity.contact`, `meta.identity.contact`, and under BOTH `blocks[]` and `content_blocks[]`
// in BOTH `props` and `content`. A path-specific edit updates one copy and reports success.
//
// ⚠️ ONLY REPUBLISHES WHAT IS ALREADY LIVE (`republishIfPublished`). Taking an unpublished draft
// live as a side effect of attaching a phone number would publish a page nobody chose to publish.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { commitTemplatePatch } from '@/lib/templates/commitTemplatePatch';
import { republishIfPublished } from '@/lib/templates/republishIfPublished';

/** Contact fields. Anything not named here is left alone, however phone-shaped it looks. */
const PHONE_KEYS = new Set(['phone', 'cta_phone', 'telephone', 'phone_number']);
/** A US phone in any common punctuation — so the OLD value is recognised however it was stored. */
const PHONEISH = /^\+?1?[\s.(-]*\d{3}[\s.)-]*\d{3}[\s.-]*\d{4}$/;

export type PushResult = {
  ok: boolean;
  /** How many phone fields in `data` were rewritten. */
  fields: number;
  republished: boolean;
  /** Set when the site was left in a state worth telling the operator about. */
  warning?: string;
};

/**
 * Rewrite every phone field in a template tree. Mutates `node`; returns the count.
 *
 * Formatting is preserved per field: a value that was punctuated stays punctuated, a bare or
 * E.164 value stays bare. The renderer strips non-digits for `tel:` either way, and matching the
 * surrounding style keeps the page looking hand-made rather than machine-edited.
 */
export function rewritePhoneFields(node: unknown, e164: string, display: string): number {
  let n = 0;
  const walk = (v: unknown, parent: any, key: string | number | null) => {
    const isPhoneKey = key !== null && PHONE_KEYS.has(String(key));

    // ⚠️ AN EMPTY PHONE FIELD IS THE COMMON CASE, AND THE FIRST VERSION SKIPPED IT ENTIRELY.
    // It only handled `typeof v === 'string'`, so a field sitting at `null` — which is what a
    // pitch site that never had a phone looks like — was never even visited. Four campaigns
    // (renton-towing, renton-electrical, seatac-towing, smyrna-towing) bought a number, had it
    // saved, had the business texted, and rendered NO phone at all, because
    // `data.meta.contact.phone` was `null` rather than a wrong string.
    if (isPhoneKey && (v === null || v === undefined || v === '')) {
      parent[key as any] = e164;
      n++;
      return;
    }

    if (typeof v === 'string') {
      if (!isPhoneKey) return;
      const s = v.trim();
      if (!s) {
        parent[key as any] = e164;
        n++;
        return;
      }
      if (!PHONEISH.test(s)) return;
      const next = /[()\-\s.]/.test(s) && !s.startsWith('+') ? display : e164;
      if (next === v) return;
      parent[key as any] = next;
      n++;
      return;
    }
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, v, i));
    if (v && typeof v === 'object') {
      return Object.entries(v as Record<string, unknown>).forEach(([k, x]) => walk(x, v, k));
    }
  };
  walk(node, null, null);
  return n;
}

/**
 * Guarantee the path the CONTACT BLOCK actually reads, creating it when absent.
 *
 * ⚠️ `templates.phone` is NOT enough, and that is the trap. `contact-form.tsx` resolves
 * `t.phone` first, which reads fine in the editor — but a PUBLISHED page renders from the
 * snapshot, and the snapshot carries `data`, not the column. So setting the column alone
 * produces a site that looks correct everywhere except to a visitor.
 *
 * `meta.contact.phone` is the first `data.*` path in that resolver's list, so it is the one
 * worth guaranteeing.
 */
export function ensureContactPhone(data: any, e164: string): boolean {
  if (!data || typeof data !== 'object') return false;
  data.meta = data.meta ?? {};
  data.meta.contact = data.meta.contact ?? {};
  const cur = data.meta.contact.phone;
  if (typeof cur === 'string' && cur.replace(/\D/g, '').replace(/^1/, '') === e164.replace(/\D/g, '').replace(/^1/, '')) {
    return false;
  }
  data.meta.contact.phone = e164;
  return true;
}

/** `+12536552016` → `(253) 655-2016`. Assumes a 10-digit US number, which is all we buy. */
export function displayUs(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^1/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}

/**
 * Point a campaign's pitch site at its tracking number.
 *
 * Best-effort by contract: the caller has already SPENT MONEY buying the number, so a failure
 * here must never turn a completed purchase into an error response. It reports instead, and the
 * operator can re-run `scripts/set-site-phone.mjs`.
 */
export async function pushTrackingNumberToSite(opts: {
  templateId: string | null | undefined;
  trackingNumber: string;
  actorId?: string | null;
}): Promise<PushResult> {
  const { templateId, trackingNumber } = opts;
  if (!templateId) return { ok: false, fields: 0, republished: false, warning: 'campaign has no pitch site' };

  const digits = trackingNumber.replace(/\D/g, '').replace(/^1/, '');
  if (digits.length !== 10) {
    return { ok: false, fields: 0, republished: false, warning: `not a US number: ${trackingNumber}` };
  }
  const e164 = `+1${digits}`;
  const display = displayUs(e164);

  const { data: tpl, error } = await supabaseAdmin
    .from('templates')
    .select('id, rev, data')
    .eq('id', templateId)
    .maybeSingle();
  if (error || !tpl) {
    return { ok: false, fields: 0, republished: false, warning: 'pitch site not found' };
  }

  const next = structuredClone((tpl as any).data ?? {});
  let fields = rewritePhoneFields(next, e164, display);
  // Belt and braces: if the tree carried no phone field at all, create the one the contact
  // block reads. A site with a bought number and nothing on the page is the failure this
  // whole function exists to prevent.
  if (ensureContactPhone(next, e164)) fields++;

  // ⚠️ `phone` goes in the SAME patch as `data`. The hero falls back to the column when
  // `cta_phone` is empty (`resolvedPhoneDigits = cta_phone || dbPhoneDigits`), so a site whose
  // only phone came from the column would otherwise keep showing the old one with `data` clean —
  // a fix that passes its own audit and changes nothing on the page.
  const commitErr = await commitTemplatePatch(
    templateId,
    (tpl as any).rev ?? 0,
    { data: next, phone: digits },
    opts.actorId ?? null,
  );
  if (commitErr) return { ok: false, fields, republished: false, warning: `commit failed: ${commitErr}` };

  const { republished, warning } = await republishIfPublished(templateId);
  return { ok: true, fields, republished, warning };
}
