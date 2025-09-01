// app/api/templates/diff/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

type Change = { path: string; type: 'added' | 'removed' | 'changed'; before?: unknown; after?: unknown };

function isObject(x: any) {
  return x !== null && typeof x === 'object';
}

// flatten object into path -> value (arrays included by index)
function flatten(obj: any, base = '', out: Record<string, any> = {}) {
  if (!isObject(obj)) {
    out[base || ''] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, base ? `${base}[${i}]` : `[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const p = base ? `${base}.${k}` : k;
    flatten(v, p, out);
  }
  return out;
}

function diffJSON(a: any, b: any, limit = 500) {
  const A = flatten(a);
  const B = flatten(b);
  const paths = new Set([...Object.keys(A), ...Object.keys(B)]);
  const changes: Change[] = [];

  for (const p of paths) {
    const hasA = p in A;
    const hasB = p in B;
    if (!hasA && hasB) changes.push({ path: p, type: 'added', after: B[p] });
    else if (hasA && !hasB) changes.push({ path: p, type: 'removed', before: A[p] });
    else {
      const va = A[p];
      const vb = B[p];
      if (JSON.stringify(va) !== JSON.stringify(vb)) {
        changes.push({ path: p, type: 'changed', before: va, after: vb });
      }
    }
    if (changes.length >= limit) break;
  }

  const summary = {
    added: changes.filter((c) => c.type === 'added').length,
    removed: changes.filter((c) => c.type === 'removed').length,
    changed: changes.filter((c) => c.type === 'changed').length,
    limited: changes.length >= limit,
  };
  return { summary, changes };
}

async function loadRef(templateId: string, ref: string) {
  if (!ref || ref === 'draft') {
    const { data, error } = await supabase.from('templates').select('data').eq('id', templateId).single();
    if (error) throw error;
    return data?.data ?? {};
  }
  if (ref === 'published') {
    const { data: site } = await supabase.from('sites').select('published_snapshot_id').eq('template_id', templateId).maybeSingle();
    const snapId = site?.published_snapshot_id;
    if (!snapId) return {};
    const { data: snap } = await supabase.from('snapshots').select('data').eq('id', snapId).single();
    return snap?.data ?? {};
  }
  // otherwise treat as snapshot id
  const { data: snap, error } = await supabase.from('snapshots').select('data').eq('id', ref).single();
  if (error) throw error;
  return snap?.data ?? {};
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templateId = searchParams.get('templateId');
  const a = searchParams.get('a'); // 'draft' | 'published' | snapshotId
  const b = searchParams.get('b'); // same

  if (!templateId) return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });

  const refA = a || 'draft';
  const refB = b || 'published';

  try {
    const [left, right] = await Promise.all([loadRef(templateId, refA), loadRef(templateId, refB)]);
    const { summary, changes } = diffJSON(left, right);
    return NextResponse.json({ summary, changes, leftRef: refA, rightRef: refB });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Diff failed' }, { status: 500 });
  }
}
