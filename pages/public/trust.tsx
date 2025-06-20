'use client';
import { useEffect, useState } from 'react';
import { json } from '../../lib/api/json.js';

export default function TrustPage() {
  const [hashes, setHashes] = useState<string[]>([]);

  useEffect(() => {
    fetch('/reports/security-hashes.json')
      .then(res => json(res, 200))
      .then(data => setHashes(data as unknown as string[]));
  }, []);

  return (
    <div className="p-6 text-text max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">🔐 Trust & Verification</h1>
      <p className="mb-4 text-sm text-zinc-400">
        All security reports are digitally signed and verifiable. Below are SHA-256 hashes of each report,
        timestamped at the time of generation.
      </p>
      <ul className="space-y-2 text-xs font-mono bg-black p-4 rounded text-zinc-200 max-h-[60vh] overflow-auto">
        {hashes.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
