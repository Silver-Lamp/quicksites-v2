// lib/templates/persistServices.ts

/**
 * Persist services via the canonical commit endpoint.
 * Writes to template.data.services (array of strings), and returns the saved list.
 */
export async function persistServices(templateId: string, services: string[]) {
  const cleaned = Array.from(
    new Set((services || []).map((s) => String(s ?? '').trim()).filter(Boolean))
  );

  const parseRev = (j: any): number => {
    const cand =
      j?.rev ??
      j?.template?.rev ??
      j?.state?.rev ??
      j?.infra?.template?.rev ??
      j?.data?.rev;
    return Number.isFinite(Number(cand)) ? Number(cand) : 0;
  };

  const loadBaseRev = async (): Promise<number> => {
    const res = await fetch(`/api/templates/state?id=${encodeURIComponent(templateId)}`, {
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json?.error || 'Failed to load template state');
    }
    return parseRev(json);
  };

  const send = async (baseRev: number) => {
    const res = await fetch('/api/templates/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: templateId,
        baseRev,
        patch: { data: { services: cleaned } },
        kind: 'save',
      }),
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 409) {
      const latest = parseRev(json) || baseRev;
      const err: any = new Error('merge_conflict');
      err.code = 409;
      err.rev = latest;
      throw err;
    }
    if (!res.ok) {
      throw new Error(json?.error || 'Commit failed');
    }

    // ✅ hydrate editor immediately from authoritative row (if returned)
    try {
      if (json?.template) {
        window.dispatchEvent(new CustomEvent('qs:template:merge', { detail: json.template }));
      } else {
        window.dispatchEvent(new Event('qs:template:invalidate'));
      }
    } catch {}

    return json;
  };

  // Load current rev for optimistic commit
  let baseRev = await loadBaseRev();

  try {
    await send(baseRev);
  } catch (e: any) {
    if (e?.code === 409) {
      // Rebase once with latest rev
      baseRev = e.rev ?? (await loadBaseRev());
      await send(baseRev);
    } else {
      throw e;
    }
  }

  // The commit path doesn’t echo the list back — return the cleaned list
  return cleaned;
}
