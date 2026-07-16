// app/api/menu/demand/[templateId]/route.ts
//
// Public demand-capture beacon for unclaimed delivered.menu drafts. A visitor tapping
// "call" or submitting an "order ahead" lead on an auto-built restaurant draft posts
// here; we log the intent (server re-checks the draft is claimable) and the claim bar
// escalates its pitch with the count. No money — this is a demand signal only.
// Flag-gated OFF (MENU_DEMAND_CAPTURE_ENABLED); per-IP rate-limited.
import { z } from 'zod';
import { json, badRequest } from '@/lib/api/json';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { clientIp } from '@/lib/rateLimit';
import { MENU_DEMAND_CAPTURE_ENABLED } from '@/lib/flags/menuDemand';
import { recordDemandEvent } from '@/lib/menu/demand';
import { maybeNotifyRestaurant } from '@/lib/menu/demandNotify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  kind: z.enum(['call', 'order_ahead']),
  contactName: z.string().trim().max(120).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  items: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: { templateId: string } }) {
  // Inert unless the operator turned demand capture on.
  if (!MENU_DEMAND_CAPTURE_ENABLED) return json({ ok: false, error: 'disabled' }, 404);

  const templateId = params.templateId;
  if (!templateId) return badRequest('missing_template');

  const limited = await rateLimitOr429(req, 'menu_demand', 20, 3600);
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    // A sendBeacon "call" ping may carry no body — treat as a bare call intent.
    raw = { kind: 'call' };
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return badRequest('invalid_body');
  const input = parsed.data;

  // An "order ahead" lead must be reachable — a name/phone is the whole point (a lead,
  // not a charge). A bare "call" intent needs nothing.
  if (input.kind === 'order_ahead' && !input.contactPhone) {
    return badRequest('phone_required');
  }

  const result = await recordDemandEvent({
    templateId,
    kind: input.kind,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    items: input.items,
    ip: clientIp(req),
  });
  if (!result.ok) {
    // not_claimable → the site isn't an open outreach draft; treat as a quiet no-op.
    const status = result.error === 'not_claimable' ? 404 : 500;
    return json({ ok: false, error: result.error }, status);
  }

  // Phase 2: this event may have crossed the threshold → text the restaurant once.
  // Best-effort and self-gated (flag OFF ⇒ instant no-op); never fails the capture.
  await maybeNotifyRestaurant(templateId);

  return json({ ok: true });
}
