// components/admin/leads-table.tsx
'use client';

import { Lead } from '@/types/lead.types';
import { useState } from 'react';

type Props = {
  leads: Lead[];
  setEditingLead?: (lead: Lead | null) => void;
  setSelectedIds?: (ids: number[]) => void;
};

export default function LeadsTable({ leads, setEditingLead, setSelectedIds }: Props) {
  const [selected, setSelected] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setSelectedIds?.(next);
      return next;
    });
  };

  return (
    <div className="overflow-x-auto border rounded">
      <table className="min-w-full table-auto text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Select</th>
            <th className="p-2">Business</th>
            <th className="p-2">City</th>
            <th className="p-2">Status</th>
            <th className="p-2">Source</th>
            <th className="p-2">Confidence</th>
            <th className="p-2">Created</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-t hover:bg-gray-50">
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={selected.includes(lead.id as number)}
                  onChange={() => toggleSelect(lead.id as number)}
                />
              </td>
              <td className="p-2">{lead.business_name}</td>
              <td className="p-2">{lead.address_city}</td>
              <td className="p-2">{lead.status}</td>
              <td className="p-2">{lead.source}</td>
              <td className="p-2">{lead.confidence?.toFixed(2)}</td>
              <td className="p-2">{new Date(lead.created_at).toLocaleDateString()}</td>
              <td className="p-2">
                <button
                  onClick={() => setEditingLead?.(lead)}
                  className="text-blue-600 hover:underline text-xs"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
