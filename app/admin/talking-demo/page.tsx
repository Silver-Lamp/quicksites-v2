// app/admin/talking-demo/page.tsx
//
// Admin surface for the Site Tour generator: pick any built site (slug or id) and generate its
// narrated audio tour + shareable MP4 reel on demand (QS block→script → HJ render). The heavy lifting
// is the client panel (components/admin/talking-demo-generator); this just gates + frames it.

import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import TalkingDemoGenerator from '@/components/admin/talking-demo-generator';

export const dynamic = 'force-dynamic';

export default async function AdminTalkingDemoPage() {
  const admin = await getAdminUser();
  if (!admin) {
    return <div className="mx-auto max-w-2xl px-6 py-20 text-center text-sm text-muted-foreground">Admins only.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-300">
          🔊 Site Tour
        </span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Generate a Site Tour</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Turn any built site into a narrated tour — the site describing and scrolling through itself, as an
        audio tour and a shareable MP4 reel. Enter a template slug or id (find them on{' '}
        <Link href="/admin/templates/list" className="text-primary hover:underline">the templates list</Link>).
        Renders are cached and the URLs are permanent, so you can re-run for free and bake the result into a
        site or an outreach QR later.
      </p>

      <div className="mt-8">
        <TalkingDemoGenerator />
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        House voice is billed to the platform; the owner's own cloned voice needs an About That grant.
        Requires <code>PARTNER_QUICKSITES_SECRET</code> — without it you'll get the script preview only.
      </p>
    </div>
  );
}
