'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link.js';

type DomainRow = {
  id: string;
  domain: string;
  city: string;
  state: string;
  template: string;
  claimed: boolean;
};

export default function Dashboard() {
  const [filterClaimed, setFilterClaimed] = useState<
    'all' | 'claimed' | 'unclaimed'
  >('all');
  const [sites, setSites] = useState<DomainRow[]>([]);

  const filter =
    filterClaimed === 'claimed'
      ? { column: 'claimed', operator: 'eq', value: true }
      : filterClaimed === 'unclaimed'
        ? { column: 'claimed', operator: 'eq', value: false }
        : undefined;

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      const mod = await import('../hooks/useLiveTableWrapper.jsx');
      const result = await mod.useLiveTableWrapper<DomainRow>(
        'domains',
        filter,
        {
          column: 'city',
        }
      );
      if (mounted) setSites(result);
    };
    loadData();

    return () => {
      mounted = false;
    };
  }, [filterClaimed]);

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Claimed Sites</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="filter">Filter:&nbsp;</label>
        <select
          id="filter"
          value={filterClaimed}
          onChange={(e) =>
            setFilterClaimed(e.target.value as 'all' | 'claimed' | 'unclaimed')
          }
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
