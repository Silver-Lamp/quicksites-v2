// app/api/admin/restaurant-directory/route.ts
//
// Operator curation for a city ordering directory, callable FROM the public page itself so
// the operator edits where they can see the result.
//
//   GET  ?campaign=<id>                     → candidates + who's currently on the list
//   POST { campaignId, action, templateId }  → hide | show | add | remove
//
// ⚠️ DIRECTORY-ONLY. Every action here changes who appears on the public list and nothing
// else: cohort membership, the restaurant's own site, and outreach are all untouched. That
// separation is the point — a display tweak must never silently drop someone from a campaign.
//
// Admin-gated on every verb. The block that calls this renders on a PUBLIC page, so the
// server is the only thing standing between a curated list and anyone with the URL.
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import { loadDirectoryCandidates } from '@/lib/outreach/directoryCandidates';
import {
  hideTemplate,
  showTemplate,
  addExtraTemplate,
  removeExtraTemplate,
} from '@/lib/outreach/directoryCuration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const campaignId = (new URL(req.url).searchParams.get('campaign') || '').trim();
  if (!campaignId) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });

  return NextResponse.json({ candidates: await loadDirectoryCandidates(campaignId) });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const campaignId = String(body?.campaignId || '').trim();
  const templateId = String(body?.templateId || '').trim();
  const action = String(body?.action || '').trim();
  if (!campaignId || !templateId) {
    return NextResponse.json({ error: 'campaignId and templateId are required' }, { status: 400 });
  }

  const actor = gate.user.id;
  switch (action) {
    case 'hide':
      await hideTemplate(campaignId, templateId, actor);
      break;
    case 'show':
      await showTemplate(campaignId, templateId, actor);
      break;
    case 'add':
      await addExtraTemplate(campaignId, templateId, actor);
      break;
    case 'remove':
      await removeExtraTemplate(campaignId, templateId, actor);
      break;
    default:
      return NextResponse.json({ error: 'action must be hide|show|add|remove' }, { status: 400 });
  }

  // Return the fresh list so the caller re-renders from server truth rather than guessing
  // what its own click did — the two diverge the moment a rule (e.g. buffet) has an opinion.
  return NextResponse.json({ ok: true, candidates: await loadDirectoryCandidates(campaignId) });
}
