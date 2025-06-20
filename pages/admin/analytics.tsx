'use client';
import { useState } from 'react';
import ThemedBarChart from '@/components/ui/themed-bar-chart';
import { Modal } from '@/components/ui/modal';
import { Input, Label } from '@/components/ui/form';

export default function AnalyticsPage() {
  const [showModal, setShowModal] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  return (
    <div className="min-h-screen bg-surface text-text p-6 space-y-6">
      <h1 className="text-2xl font-bold">📈 Site Analytics</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Date From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <Label>Date To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="bg-zinc-900 rounded p-4 shadow">
        <ThemedBarChart />
      </div>

      <div>
        <button
          onClick={() => setShowModal(true)}
          className="mt-4 px-4 py-2 bg-brand text-white rounded hover:opacity-90"
        >
          Share / Export
        </button>
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)}>
        <h2 className="text-lg font-semibold mb-2">🔗 Share this report</h2>
        <p className="text-sm text-zinc-300">
          Coming soon: PDF export, link share, and team insights.
        </p>
      </Modal>
    </div>
  );
}
