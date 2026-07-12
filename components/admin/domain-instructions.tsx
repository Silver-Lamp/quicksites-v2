'use client';

// General DNS reference shown before/while connecting a custom domain.
// The actual records to add are the Vercel A + www CNAME below (the same ones
// the connect flow writes automatically for Namecheap). After connecting, the
// panel renders the live, domain-specific records returned by Vercel — this
// block is just an at-a-glance reference.

const A_VALUE = '76.76.21.21';
const CNAME_VALUE = 'cname.vercel-dns.com';

export default function DomainInstructions({ domain }: { domain?: string }) {
  const apex = (domain || 'yourdomain.com').replace(/^www\./i, '');

  return (
    <div className="mt-4 text-sm text-white/80 border border-white/10 rounded p-4 bg-neutral-900">
      <p className="mb-2">
        At your registrar’s DNS settings, point <code>{apex}</code> at your site with these two records:
      </p>
      <div className="space-y-2">
        <div className="rounded border border-white/10 p-2">
          <div><strong>Type:</strong> A</div>
          <div><strong>Name / Host:</strong> <code>@</code></div>
          <div><strong>Value:</strong> <code>{A_VALUE}</code></div>
        </div>
        <div className="rounded border border-white/10 p-2">
          <div><strong>Type:</strong> CNAME</div>
          <div><strong>Name / Host:</strong> <code>www</code></div>
          <div><strong>Value:</strong> <code>{CNAME_VALUE}</code></div>
        </div>
      </div>
      <p className="mt-2 text-xs text-white/60">
        Tip: if you buy the domain through the “Search &amp; buy” tool above, this is all handled for you — no records to add.
      </p>
      <p className="mt-1 text-xs text-yellow-400">⚠ DNS changes can take several minutes to propagate.</p>
    </div>
  );
}
