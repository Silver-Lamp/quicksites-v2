// lib/admin/guestFunnelServer.ts
//
// Fetch the rows computeGuestFunnel needs. auth.users is not reachable through PostgREST, so
// guests come from the auth admin API (paged; the whole user table is < 100 rows today and the
// call is capped at 1,000 per page — revisit if that ever changes). Never throws: the ops
// dashboard must render with an empty funnel rather than not at all.
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  computeGuestFunnel,
  computeGuestFunnelSteps,
  EMPTY_GUEST_FUNNEL,
  type GuestFunnel,
  type GuestFunnelSteps,
  type GuestTemplateRow,
  type GuestUserRow,
} from './guestFunnel';
import { contactOnRecord } from './guestContacts';

export async function loadGuestFunnel(): Promise<GuestFunnel> {
  try {
    const admin = supabaseAdmin as any;
    const [{ data: lu }, { data: tpls }, evs] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin
        .from('templates')
        .select('id, owner_id, created_at, updated_at, claim_source, business_name, template_name, data')
        .eq('claim_source', 'guest_build')
        .limit(2000),
      admin.from('guest_upgrade_events').select('event, guest_user_id').limit(10000),
    ]);

    // ⚠️ An ERROR and an EMPTY TABLE must not look the same here. A failed read stays `null` and
    // renders as "—"; only a successful read of zero rows is allowed to say zero. Getting this
    // backwards is how the funnel spent two months reporting a confident, wrong zero.
    const steps: GuestFunnelSteps | null = evs?.error
      ? null
      : computeGuestFunnelSteps((evs?.data ?? []) as any[]);
    if (evs?.error) console.warn('[ops] guest funnel steps unavailable:', evs.error.message);
    const guests: GuestUserRow[] = ((lu?.users ?? []) as any[])
      .filter((u) => !!u.is_anonymous)
      .map((u) => ({ id: u.id, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null, new_email: u.new_email ?? null, is_anonymous: true }));
    const templates: GuestTemplateRow[] = ((tpls ?? []) as any[]).map((t) => {
      const rec = contactOnRecord(t.data, t.business_name || t.template_name);
      return {
        id: t.id,
        owner_id: t.owner_id,
        created_at: t.created_at,
        updated_at: t.updated_at,
        claim_source: t.claim_source,
        rebuilt_from: rec.sourceUrl,
        has_contact: !!rec.phone || (!!rec.email && !rec.emailIsPlaceholder),
      };
    });
    // Converted owners are not in `guests` (they are no longer anonymous); computeGuestFunnel
    // counts a guest site whose owner is absent from the guest set as converted.
    return computeGuestFunnel(guests, templates, steps);
  } catch (e) {
    console.warn('[ops] guest funnel unavailable:', (e as any)?.message || e);
    return EMPTY_GUEST_FUNNEL;
  }
}
