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
//   const [selected, setSelected] = useState<number[]>([]);
  const [industryFilter, setIndustryFilter] = useState<string | null>(null);

  const industryCounts = leads.reduce<Record<string, number>>((acc, lead) => {
    const key = lead.industry || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const filteredLeads = industryFilter
    ? leads.filter((l) => l.industry === industryFilter)
    : leads;

  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const aInvalid = a.business_name === '[INVALID LEAD]';
    const bInvalid = b.business_name === '[INVALID LEAD]';
    if (aInvalid === bInvalid) return 0;
    return aInvalid ? -1 : 1;
  });
  const [selected, setSelected] = useState<number[]>([]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      setSelectedIds?.(next);
      return next;
    });
  };

  return (
    <>
    <div className="mb-4 flex flex-wrap gap-2 text-sm text-gray-300">
        {Object.entries(industryCounts).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setIndustryFilter((prev) => (prev === key ? null : key))}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border transition ${
              industryFilter === key ? 'bg-blue-600 text-white border-blue-500' : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
            }`}>
            {key === 'towing' && '🚛'}
            {key === 'concrete' && '🧱'}
            {key === 'plumbing' && '🛁'}
            {key === 'electrical' && '⚡'}
            {key !== 'towing' && key !== 'concrete' && key !== 'plumbing' && key !== 'electrical' && '🏷️'} {key}: {count}</button>
        ))}
      {industryFilter && (
        <button
          onClick={() => setIndustryFilter(null)}
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border border-gray-500 bg-gray-700 text-white hover:bg-gray-600 transition"
        >
          ❌ Clear Filters
        </button>
      )}
      </div>

      <div className="overflow-x-auto border rounded">
      <table className="min-w-full table-auto text-sm text-white">
        <thead>
          <tr className="bg-gray-800 text-white text-left">
            <th className="p-2">Select</th>
            <th className="p-2">Business</th>
            <th className="p-2">City</th>
            <th className="p-2">Industry</th>
            <th className="p-2">Status</th>
            <th className="p-2">Source</th>
            <th className="p-2">Confidence</th>
            <th className="p-2">Created</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedLeads.map((lead) => (
            <tr
              key={lead.id}
              className={`border-t hover:bg-gray-700 ${lead.business_name === '[INVALID LEAD]' ? 'text-red-400 italic' : ''}`}
            >
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={selected.includes(Number(lead.id))}
                  onChange={() => toggleSelect(Number(lead.id))}
                />
              </td>
              <td className="p-2 flex items-center gap-2">
                {lead.business_name}
                {lead.business_name === '[INVALID LEAD]' && (
                  <span title="Invalid lead" className="text-red-300">⚠️</span>
                )}
              </td>
              <td className="p-2">{lead.address_city}</td>
              <td className="p-2">
                <span className={
                  `inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-blue-900 text-blue-300` +
                  (lead.industry === 'towing' ? ' before:content-[\'🚛\']' : '') +
                  (lead.industry === 'concrete' ? ' before:content-[\'🧱\']' : '') +
                  (lead.industry === 'plumbing' ? ' before:content-[\'🛁\']' : '') +
                  (lead.industry === 'electrical' ? ' before:content-[\'⚡\']' : '')
                }>
                  {lead.industry || '—'}
                </span>
              </td>
              <td className="p-2">{lead.status}</td>
              <td className="p-2">{lead.source}</td>
              <td className="p-2">{lead.confidence?.toFixed(2)}</td>
              <td className="p-2">{new Date(lead.created_at).toLocaleDateString()}</td>
              <td className="p-2">
                <button
                  onClick={() => setEditingLead?.(lead)}
                  className="text-blue-400 hover:underline text-xs"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
