'use client';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function ForksPage() {
  const router = useRouter();
  const { template_id } = router.query;
  const [forks, setForks] = useState([]);

  useEffect(() => {
    if (!template_id) return;
    fetch('/api/forks-tree?template_id=' + template_id)
      .then(res => res.json())
      .then(setForks);
  }, [template_id]);

  return (
    <div className="text-white p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">🌱 Remix Lineage</h1>
      <ul className="space-y-3 border-l border-zinc-600 pl-4">
        {forks.map((f, i) => (
          <li key={i}>
            <div className="text-sm text-zinc-300">
              <strong>@{f.handle}</strong> → {f.name}
              <div className="text-xs text-zinc-500">{f.created_at}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
