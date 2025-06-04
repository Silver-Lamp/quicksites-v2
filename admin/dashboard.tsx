'use client';

import { useState } from 'react';
import { useLiveTable } from '@/hooks/useLiveTable';
import Link from 'next/link';

export default function Dashboard() {
  const [filterClaimed, setFilterClaimed] = useState<'all' | 'claimed' | 'unclaimed'>('all');

  const filter =
    filterClaimed === 'claimed'
      ? { column: 'claimed', operator: 'eq', value: true }
      : filterClaimed === 'unclaimed'
      ? { column: 'claimed', operator: 'eq', value: false }
      : undefined;

  const sites = useLiveTable('domains', filter, { column: 'city' });

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Claimed Sites</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="filter">Filter:&nbsp;</label>
        <select
          id="filter"
          value={filterClaimed}
          onChange={(e) => setFilterClaimed(e.target.value as any)}
        >
          <option value="all">All</option>
          <option value="claimed">Claimed</option>
          <option value="unclaimed">Unclaimed</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>City</th>
            <th>State</th>
            <th>Template</th>
            <th>Claimed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.id}>
              <td>{site.domain}</td>
              <td>{site.city}</td>
              <td>{site.state}</td>
              <td>{site.template}</td>
              <td>{site.claimed ? '✅' : '—'}</td>
              <td>
                <Link href={`/sites/${site.domain}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
