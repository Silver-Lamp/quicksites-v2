import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function HeatmapPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [domainFilter, setDomainFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [domainOptions, setDomainOptions] = useState<string[]>([]);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [presets, setPresets] = useState<{ name: string; domain?: string; action?: string }[]>([]);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('analytics-presets');
    if (saved) setPresets(JSON.parse(saved));
  }, []);

  const savePreset = () => {
    const newPreset = {
      name: presetName,
      domain: domainFilter,
      action: actionFilter,
    };
    const all = [...presets, newPreset];
    localStorage.setItem('analytics-presets', JSON.stringify(all));
    setPresets(all);
    setPresetName('');
  };

  const applyPreset = (p: any) => {
    setDomainFilter(p.domain || '');
    setActionFilter(p.action || '');
  };

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('user_action_logs').select('*');
      setLogs(data || []);

      const domains = [...new Set((data || []).map((d) => d.domain_id || '—'))];
      const types = [...new Set((data || []).map((d) => d.action_type || ''))];
      setDomainOptions(domains);
      setActionOptions(types);
    };

    load();
    if (autoRefresh) {
      const timer = setInterval(load, 10000);
      return () => clearInterval(timer);
    }
  }, [autoRefresh]);

  const filteredLogs = logs.filter(
    (l) =>
      (!domainFilter || l.domain_id === domainFilter) &&
      (!actionFilter || l.action_type === actionFilter)
  );

  const dailyCounts = filteredLogs.reduce(
    (acc, log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sortedDates = Object.keys(dailyCounts).sort();
  const chartData = {
    labels: sortedDates,
    datasets: [
      {
        label: 'Action Count',
        data: sortedDates.map((d) => dailyCounts[d]),
        backgroundColor: '#3b82f6',
      },
    ],
  };

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Lead Action Timeline</h1>

      <div className="mb-4 flex flex-wrap gap-4 text-sm items-center">
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
        >
          <option value="">All Domains</option>
          {domainOptions.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1"
        >
          <option value="">All Actions</option>
          {actionOptions.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

        <input
          placeholder="Preset name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          className="bg-gray-700 px-2 py-1 text-white rounded border border-gray-600"
        />

        <button onClick={savePreset} className="bg-blue-600 px-3 py-1 rounded text-white">
          Save
        </button>

        <select
          onChange={(e) => applyPreset(presets[+e.target.value])}
          className="bg-gray-700 text-white px-2 py-1 border border-gray-600 rounded"
        >
          <option value="">Presets</option>
          {presets.map((p, i) => (
            <option key={i} value={i}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-xs text-gray-300 ml-auto">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={() => setAutoRefresh(!autoRefresh)}
          />
          Auto-Refresh
        </label>
      </div>

      {sortedDates.length ? (
        <Bar
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: 'Actions per Day' },
            },
            scales: {
              x: { ticks: { color: '#ccc' }, grid: { color: '#444' } },
              y: { ticks: { color: '#ccc' }, grid: { color: '#444' } },
            },
          }}
        />
      ) : (
        <p className="text-gray-400">No data available</p>
      )}
    </div>
  );
}
