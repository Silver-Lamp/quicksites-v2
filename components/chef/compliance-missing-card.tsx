'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type Payload = {
  overall:'ok'|'warning'|'blocked';
  missing:string[];
  expiring:string[];
  labels:Record<string,string>;
};

export default function ComplianceMissingCard() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch('/api/compliance/status');
      if (r.ok) setData(await r.json());
    })();
  }, []);

  if (!data) return null;
  if (data.overall === 'ok' && !data.expiring.length) return null;

  return (
    <div className="rounded-2xl border p-4 space-y-3 bg-amber-50">
      <div className="font-semibold">Compliance status: {data.overall === 'ok' ? 'OK' : 'Action needed'}</div>

      {!!data.missing.length && (
        <div>
          <div className="text-sm font-medium mb-1">Missing</div>
          <ul className="list-disc pl-5 text-sm">
            {data.missing.map(code => (
              <li key={code}>
                {data.labels[code] || code} — <Link className="underline" href={`/chef/compliance?focus=${code}`}>Upload</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!data.expiring.length && (
        <div>
          <div className="text-sm font-medium mb-1">Expiring soon</div>
          <ul className="list-disc pl-5 text-sm">
            {data.expiring.map(code => (
              <li key={code}>
                {data.labels[code] || code} — <Link className="underline" href={`/chef/compliance?focus=${code}`}>Update</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        You must complete required items before publishing meals.
      </div>
    </div>
  );
}
