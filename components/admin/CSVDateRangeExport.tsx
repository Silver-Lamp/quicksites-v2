import { useState } from 'react';

export default function CSVDateRangeExport({
  type,
}: {
  type: 'feedback' | 'checkins';
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const url = `/api/logs/${type}.csv?start=${start}&end=${end}`;

  return (
    <div className="mb-4 flex flex-wrap gap-2 items-center text-sm">
      <label>
        Start:{' '}
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
        />
      </label>
      <label>
        End:{' '}
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1"
        />
      </label>
      <a
        href={url}
        className="ml-2 px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-white"
        download
      >
        ⬇️ Download Range
      </a>
    </div>
  );
}
