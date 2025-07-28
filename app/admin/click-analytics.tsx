'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function ClickAnalytics() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('click_summary').select('*');
      if (error) console.error('Error loading click_summary:', error);
      else setData(data);
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">📊 Click Analytics</h1>
      <table className="w-full text-sm border-collapse border border-zinc-600">
        <thead>
          <tr className="bg-zinc-800 text-zinc-300">
            <th className="border p-2">Date</th>
            <th className="border p-2">Block</th>
            <th className="border p-2">Handle</th>
            <th className="border p-2">Action</th>
            <th className="border p-2">Count</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t border-zinc-700">
              <td className="p-2">{new Date(row.day).toLocaleDateString()}</td>
              <td className="p-2">{row.block_id}</td>
              <td className="p-2">@{row.handle}</td>
              <td className="p-2">{row.action}</td>
              <td className="p-2 text-right">{row.click_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
