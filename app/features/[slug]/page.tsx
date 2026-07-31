// app/features/[slug]/page.tsx
//
// The destination the feature cards were already promising.
//
// The gallery cards lifted on hover and showed a pointer, but 14 of 16 features had no
// doc_href or demo_href — an affordance with nothing behind it. Rather than strip the
// affordance, this gives every feature a real page: the blurb, the mechanics from
// lib/features/detail.ts, any caveat stated in the open, and its siblings.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import PageBackdrop from '@/components/site/page-backdrop';
import { Badge } from '@/components/ui/badge';
import { featureDetail } from '@/lib/features/detail';

export const revalidate = 60;

type Row = {
  id: string;
  slug: string | null;
  title: string;
  blurb: string | null;
  category: string | null;
  badge: string | null;
  featured: boolean | null;
  doc_href: string | null;
  demo_href: string | null;
};

const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function load(slug: string): Promise<{ row: Row | null; siblings: Row[] }> {
  const sel = 'id, slug, title, blurb, category, badge, featured, doc_href, demo_href';
  const { data: row } = await db().from('features').select(sel).eq('slug', slug).maybeSingle();
  if (!row) return { row: null, siblings: [] };
  const { data: sib } = await db()
    .from('features')
    .select(sel)
    .eq('category', (row as any).category)
    .neq('slug', slug)
    .limit(3);
  return { row: row as Row, siblings: (sib ?? []) as Row[] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { row } = await load(slug);
  if (!row) return { title: 'Feature — QuickSites' };
  return {
    title: `${row.title} — QuickSites`,
    description: row.blurb ?? undefined,
  };
}

/** A real destination only — never '/' , which is how these pages sent readers home before. */
function realHref(h: string | null | undefined): string | null {
  const v = (h ?? '').trim();
  return v && v !== '/' ? v : null;
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { row, siblings } = await load(slug);
  if (!row) notFound();

  const detail = featureDetail(row.slug);
  const doc = realHref(row.doc_href);
  const demo = realHref(row.demo_href);

  return (
    <>
      <SiteHeader sticky />
      <main className="relative min-h-screen bg-background text-foreground">
        {/* Pure-CSS backdrop off the theme accent — costs nothing, renders at first paint,
            and cannot 404 the way a background image can. */}
        <PageBackdrop style="aurora" />

        <div className="relative mx-auto max-w-5xl px-6 pt-14 pb-6">
          <Link
            href="/features"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← All features
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {row.category && (
              <span className="text-xs uppercase tracking-[0.18em] text-sky-400">{row.category}</span>
            )}
            {row.badge && <Badge variant="secondary">{row.badge}</Badge>}
          </div>

          <h1 className="mt-3 max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {row.title}
          </h1>
          {row.blurb && (
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{row.blurb}</p>
          )}
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pb-16">
          {detail ? (
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Double-width: the explanation gets the room, the mechanics sit beside it. */}
              <section className="rounded-2xl border border-border bg-card p-7 lg:col-span-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  What it does
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-card-foreground">{detail.what}</p>

                {detail.caveat && (
                  // Stated ON THE PAGE, not in a footnote. A features page is the easiest place
                  // to imply something is finished when it isn't.
                  <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                    {detail.caveat}
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-7 lg:col-span-2">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                  How it works
                </h2>
                <ul className="mt-4 space-y-3.5">
                  {detail.how.map((h) => (
                    <li key={h} className="flex gap-3 text-sm leading-relaxed text-card-foreground">
                      <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-7 text-muted-foreground">
              More detail on this one is still being written.
            </div>
          )}

          {(doc || demo) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {demo && (
                <Link
                  href={demo}
                  className="rounded-xl bg-sky-500 px-5 py-3 font-semibold text-zinc-950 transition hover:bg-sky-400"
                >
                  See it live →
                </Link>
              )}
              {doc && (
                <Link
                  href={doc}
                  className="rounded-xl border border-border px-5 py-3 font-semibold transition hover:border-sky-500/40 hover:bg-sky-500/5"
                >
                  Read the details →
                </Link>
              )}
            </div>
          )}

          {siblings.length > 0 && (
            <section className="mt-14">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                More in {row.category}
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {siblings.map((s) => (
                  <Link
                    key={s.id}
                    href={`/features/${s.slug}`}
                    className="group rounded-xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-sky-500/40"
                  >
                    <div className="font-medium text-card-foreground">{s.title}</div>
                    <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.blurb}</div>
                    <div className="mt-3 text-sm text-sky-400 transition group-hover:translate-x-0.5">
                      Read →
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="mt-16 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-lg font-semibold text-card-foreground">
              Every feature here is on the free tier.
            </p>
            <p className="mt-1.5 text-muted-foreground">
              We earn a small share when your site sells — not a monthly bill.
            </p>
            <Link
              href="/build"
              className="mt-5 inline-block rounded-xl bg-sky-500 px-6 py-3 font-semibold text-zinc-950 transition hover:bg-sky-400"
            >
              Build your site free →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
