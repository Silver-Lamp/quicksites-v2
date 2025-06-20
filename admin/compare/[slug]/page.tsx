import React from 'react';

type CampaignComparisonProps = {
  slug: string;
  data?: string[] | null;
};

export function CampaignComparison({ slug, data }: CampaignComparisonProps) {
  return (
    <div className="p-4 bg-zinc-800 border border-zinc-600 rounded text-white">
      <h2 className="text-xl font-semibold mb-2">🔍 Campaign Comparison: {slug}</h2>

      {data ? (
        <div>
          <p className="text-sm text-zinc-400 mb-1">Available slugs:</p>
          <ul className="list-disc pl-6 text-sm">
            {data.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No data loaded yet.</p>
      )}
    </div>
  );
}
