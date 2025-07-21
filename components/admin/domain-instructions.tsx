'use client';

import { useEffect } from 'react';

export default function DomainInstructions({ domain }: { domain: string }) {
  const record = `_verify.${domain}`;
  const expected = 'quicksites';

  return (
    <div className="mt-4 text-sm text-white/80 border border-white/10 rounded p-4 bg-neutral-900">
      <p className="mb-2">To verify your custom domain, create the following DNS TXT record:</p>
      <div className="space-y-1">
        <div><strong>Type:</strong> TXT</div>
        <div><strong>Name:</strong> <code>{record}</code></div>
        <div><strong>Value:</strong> <code>{expected}</code></div>
      </div>
      <p className="mt-2 text-xs text-yellow-400">⚠ DNS changes may take several minutes to propagate.</p>
    </div>
  );
}
