'use client';
import { useEffect, useState } from 'react';

export default function ScreenshotQueuePage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    fetch('/api/screenshot/queue').then((res) => res.json()).then(setItems);
  }, []);

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">📸 Screenshot Queue</h1>
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr>
            <th className="border-b p-2">Domain</th>
            <th className="border-b p-2">Status</th>
            <th className="border-b p-2">Requested</th>
            <th className="border-b p-2">Completed</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id}>
              <td className="p-2">{item.domain}</td>
              <td className="p-2">{item.status}</td>
              <td className="p-2">{new Date(item.requested_at).toLocaleString()}</td>
              <td className="p-2">{item.completed_at ? new Date(item.completed_at).toLocaleString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
