// lib/health/showcaseLinks.ts
//
// Are the sites we show off on the homepage actually alive?
//
// ⚠️ THIS FETCHES THE URL. IT DOES NOT ASK THE DATABASE. That distinction is the whole reason the
// check exists. `ecopest` sat on the homepage as a demo with `templates.published = true`,
// `archived = false`, rev 44 — and served a 404, because it had no `template_versions` row, no
// `published_sites` row and no legacy `sites` row. Nothing to snapshot, nothing to render. Every
// DB-shaped check would have called it healthy.
//
// ⚠️ AND IT MEASURES RENDERED TEXT, NOT JUST STATUS. Four homepage entries return 200 with ~230–250
// characters — a shell with no content. A 200 is not proof a visitor sees a site, which is the same
// lesson as the backdrop that rendered and reached no pixel (CLAUDE.md §5b): the failure mode of a
// page is often silence, not an error.

export type LinkHealth = {
  path: string;
  status: number | 'ERR';
  textLength: number;
  verdict: 'ok' | 'broken' | 'thin';
  note?: string;
};

/** Below this, a 200 is a shell rather than a page. The four known-thin entries sit at 229–249. */
export const THIN_CHARS = 300;

/** Strip markup and collapse whitespace — what a reader actually gets. */
export function visibleText(htmlDoc: string): string {
  const noScript = htmlDoc.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
  return noScript
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function verdictFor(status: number | 'ERR', textLength: number): LinkHealth['verdict'] {
  if (status !== 200) return 'broken';
  return textLength < THIN_CHARS ? 'thin' : 'ok';
}

/** Extract the internal /sites/<slug> links a visitor can click on a rendered page. */
export function sitePathsFrom(htmlDoc: string): string[] {
  const found = new Set<string>();
  const rx = /href="(\/sites\/[^"#?]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(htmlDoc)) !== null) found.add(m[1]);
  return Array.from(found).sort();
}

export async function checkOne(
  base: string,
  path: string,
  timeoutMs = 20_000
): Promise<LinkHealth> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, { signal: ctrl.signal, redirect: 'follow' });
    const text = visibleText(await res.text());
    return {
      path,
      status: res.status,
      textLength: text.length,
      verdict: verdictFor(res.status, text.length),
    };
  } catch (e) {
    return {
      path,
      status: 'ERR',
      textLength: 0,
      verdict: 'broken',
      note: (e as Error)?.message?.slice(0, 80),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Bounded concurrency — this walks ~90 URLs and must not stampede our own origin. */
export async function checkAll(
  base: string,
  paths: string[],
  concurrency = 6
): Promise<LinkHealth[]> {
  const out: LinkHealth[] = [];
  const queue = [...paths];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) out.push(await checkOne(base, p));
    })
  );
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function summarize(results: LinkHealth[]) {
  const broken = results.filter((r) => r.verdict === 'broken');
  const thin = results.filter((r) => r.verdict === 'thin');
  return { total: results.length, ok: results.length - broken.length - thin.length, broken, thin };
}
