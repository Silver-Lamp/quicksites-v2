// app/api/admin/collab/version/route.ts
//
// Operator-only: register a newly-built template as the next version of an option.
//
// ⚠️ IT REGISTERS, IT DOES NOT BUILD. Duplicating a template, applying the feedback, verifying the
// result and publishing it is the Custom Sites pipeline (docs/CUSTOM_SITES.md §2 + §7) — a
// checklist written because every step on it has failed silently at least once. An endpoint that
// created and published a variant in one call would make skipping that checklist the default path,
// and the thing skipped would be the verification.
//
// ⚠️ SEEDING IS SEPARATE AND IDEMPOTENT. A collab that predates versioning has its options in
// `template_ids`; `seed: true` writes those out as v1 rows so a v2 has something to follow. It
// does nothing at all if any version row already exists — re-seeding a live lineage would renumber
// versions the client has already been reading.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { getCollab } from '@/lib/collab/collabs';
import { addOptionVersion, seedVersionsFromTemplateIds, resolveOptions } from '@/lib/collab/versions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const body = await req.json().catch(() => ({}) as any);
  const collabId = String(body?.collabId ?? '');
  if (!collabId) return NextResponse.json({ error: 'collabId required' }, { status: 400 });

  const collab = await getCollab(collabId);
  if (!collab) return NextResponse.json({ error: 'no such collab' }, { status: 404 });

  if (body?.seed === true) {
    const n = await seedVersionsFromTemplateIds(collab);
    const options = await resolveOptions(collab);
    return NextResponse.json({ ok: true, seeded: n, options });
  }

  const optionKey = String(body?.optionKey ?? '').toUpperCase().trim();
  const templateId = String(body?.templateId ?? '');
  if (!optionKey || !templateId) {
    return NextResponse.json({ error: 'optionKey and templateId required' }, { status: 400 });
  }

  // ⚠️ Refuse an option letter that does not exist yet. A typo ('D' for 'B') would otherwise
  // silently create a fourth option on a client's page — three layouts becoming four with no
  // explanation, one of them a revision she was never told about.
  const options = await resolveOptions(collab);
  if (!options.some((o) => o.key === optionKey)) {
    return NextResponse.json(
      { error: `no option "${optionKey}" here — existing: ${options.map((o) => o.key).join(', ') || '(none)'}` },
      { status: 400 },
    );
  }

  const version = await addOptionVersion(collabId, optionKey, templateId, body?.note ?? null);
  if (!version) return NextResponse.json({ error: 'could not add version' }, { status: 400 });
  return NextResponse.json({ ok: true, version });
}
