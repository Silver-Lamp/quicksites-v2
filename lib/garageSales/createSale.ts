// lib/garageSales/createSale.ts
//
// Create a yard sale WITHOUT a printed sticker — the self-serve path.
//
// ⚠️ UNTIL NOW THE ONLY WAY TO EXIST WAS TO HOLD A PHYSICAL STICKER. `POST
// /api/garage-sales/activate` claims a printed code, so a seller who simply found
// yardsalesites.com could read a directory of other people's sales and do nothing at all. The
// product had no front door.
//
// That matters more than a missing feature normally would, because of what the review concluded
// about this whole line (PorchHearth, crosstalk 2026-08-17): the honest, always-true value here
// is **a page for your sale that you can text to anyone** — self-contained, worth the same to the
// first seller as the thousandth, needing no directory and no footfall claim. That product is
// this function. Everything else — the directory, the SEO, a September postcard — is downstream
// of a stranger being able to make one in a minute.
//
// ── The schema constraint that decides the shape ─────────────────────────────────────────────
//
// `garage_sales.sticker_code` is a FOREIGN KEY to `garage_sale_stickers(code)`. So a self-serve
// sale cannot simply invent a code and skip the sticker table; the row has to exist first, or the
// insert is rejected. Rather than fight that, we mint a code and record it with `batch =
// 'self-serve'`, which turns the constraint into a useful distinction: a code whose batch is
// 'self-serve' was never printed, and a code with a real batch label came off a sheet. The two
// are now separable in one column instead of being conflated or tracked in a new table.
//
// A consequence worth stating: every sale reaches /s/<code> and gets QR codes and printable
// signs for free, because those paths key on the code and neither knows nor cares how it was
// minted.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { mintCode } from '@/lib/garageSales/codes';

/** Codes minted here rather than printed. Queryable, so "how many self-serve?" is one filter. */
export const SELF_SERVE_BATCH = 'self-serve';

export type CreateSaleInput = {
  ownerId: string;
  title: string;
  description?: string | null;
  /** Street line. Withheld from the public page until the sale starts — see address.ts. */
  addressLine?: string | null;
  /** What a shopper sees before it starts, e.g. "Maple St & 4th Ave". */
  blockLabel?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  startsAt: string;
  endsAt: string;
  /** Venmo / Cash App / PayPal handles. Money goes to the seller; we take nothing. */
  paymentHandles?: Record<string, string> | null;
  /** False keeps the sale off the public directory but still reachable by its own link. */
  listed?: boolean;
};

export type CreateSaleResult =
  | { ok: true; code: string; saleId: string }
  | { ok: false; error: string };

/**
 * Validate the parts a page cannot fake. Times especially: a sale that ends before it starts
 * renders as permanently over, and the seller has no way to tell from the form that they did it.
 */
export function validateSaleInput(i: CreateSaleInput): string | null {
  if (!i.ownerId) return 'Sign in first.';
  if (!(i.title || '').trim()) return 'Give the sale a name.';

  const start = Date.parse(i.startsAt);
  const end = Date.parse(i.endsAt);
  if (!Number.isFinite(start)) return 'When does it start?';
  if (!Number.isFinite(end)) return 'When does it end?';
  if (end <= start) return 'The sale ends before it starts — check the times.';

  // A sale page expires from its own data (see readSticker), so a multi-week "sale" would be a
  // permanent listing wearing a weekend's clothes. Two weeks is generous for an estate sale.
  if (end - start > 14 * 24 * 60 * 60 * 1000) return 'That is longer than two weeks — is it really one sale?';

  // Nothing to show a shopper. Not fatal for the shareable link, but it cannot go in a directory
  // that people drive to.
  if (i.listed !== false && !(i.city || '').trim() && !(i.blockLabel || '').trim()) {
    return 'Add at least a cross street or a city so shoppers know where to go.';
  }
  return null;
}

/**
 * Mint a code, record it as self-serve, and insert the sale.
 *
 * Ordering is forced by the foreign key: sticker row first, then the sale. If the sale insert
 * fails we delete the code we just reserved, so a failed attempt does not permanently burn a
 * short, human-typable code — there are ~5.9e8 of them, which is plenty until something starts
 * leaking them a few at a time.
 */
export async function createSelfServeSale(input: CreateSaleInput): Promise<CreateSaleResult> {
  const invalid = validateSaleInput(input);
  if (invalid) return { ok: false, error: invalid };

  // Retry a couple of times on the astronomically unlikely collision rather than failing the
  // seller — the code is the primary key, so a clash is a hard error rather than a silent merge.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = mintCode();

    const { error: codeErr } = await supabaseAdmin
      .from('garage_sale_stickers')
      .insert({
        code,
        batch: SELF_SERVE_BATCH,
        claimed_by: input.ownerId,
        claimed_at: new Date().toISOString(),
      });
    if (codeErr) {
      if (/duplicate|unique/i.test(codeErr.message)) continue;
      return { ok: false, error: 'Could not reserve an address for your sale.' };
    }

    const { data: sale, error: saleErr } = await supabaseAdmin
      .from('garage_sales')
      .insert({
        sticker_code: code,
        owner_id: input.ownerId,
        title: input.title.trim(),
        description: (input.description || '').trim() || null,
        address_line: (input.addressLine || '').trim() || null,
        block_label: (input.blockLabel || '').trim() || null,
        city: (input.city || '').trim() || null,
        state: (input.state || '').trim() || null,
        postal_code: (input.postalCode || '').trim() || null,
        // Block-level until the sale opens. The default in the schema, restated here so that a
        // future caller passing an exact line cannot silently publish a house number early.
        address_precision: 'block',
        address_public_from: input.startsAt,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        payment_handles: input.paymentHandles ?? {},
        listed: input.listed !== false,
      })
      .select('id')
      .single();

    if (saleErr || !sale) {
      // Release the reserved code — see the note above.
      await supabaseAdmin.from('garage_sale_stickers').delete().eq('code', code);
      return { ok: false, error: 'Could not create the sale. Please try again.' };
    }

    return { ok: true, code, saleId: (sale as any).id as string };
  }

  return { ok: false, error: 'Could not reserve an address for your sale.' };
}
