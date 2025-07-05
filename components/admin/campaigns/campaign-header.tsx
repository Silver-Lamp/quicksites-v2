// components/admin/campaigns/CampaignHeader.tsx

import { Dispatch, SetStateAction } from 'react';

type Props = {
  showTimestamps: boolean;
  setShowTimestamps: Dispatch<SetStateAction<boolean>>;
};

export default function CampaignHeader({ showTimestamps, setShowTimestamps }: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
      <h1 className="text-xl font-bold text-white">Campaigns</h1>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={showTimestamps}
          onChange={(e) => setShowTimestamps(e.target.checked)}
        />
        Show timestamps
      </label>
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <span>Radius:</span>
          <select className="bg-zinc-800 border border-zinc-600 text-white px-2 py-1 rounded">
            {[10, 25, 50, 100].map((r) => (
              <option key={r} value={r}>{`${r} mi`}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
