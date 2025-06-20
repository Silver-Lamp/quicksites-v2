import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient.js';
import QRCode from 'react-qr-code';

export default function PrintCard() {
  const router = useRouter();
  const { id } = router.query;
  const [lead, setLead] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('leads')
      .select('*, domains(domain)')
      .eq('id', id)
      .single()
      .then(({ data }) => setLead(data));

    supabase
      .from('user_action_logs')
      .select('*')
      .eq('lead_id', id)
      .order('timestamp', { ascending: false })
      .then(({ data }) => setLogs(data || []));
  }, [id]);

  const claimUrl = lead?.domains?.domain
    ? `https://${lead.domains.domain}`
    : 'https://quicksites.ai/claim';

  return lead ? (
    <div className="p-6 max-w-lg mx-auto text-black bg-white print:bg-white print:text-black">
      <h1 className="text-2xl font-bold mb-4">You've Got a Site!</h1>
      <p className="mb-2">
        Hey <strong>{lead.business_name}</strong>,
      </p>
      <p className="mb-2">We built you a website and it's ready to preview or claim at:</p>
      <p className="mb-2 text-blue-600">{claimUrl}</p>

      <img
        src={`/screenshots/${lead.domains?.domain || 'default'}.png`}
        alt="Site preview"
        className="mt-4 w-full border rounded"
      />

      <div className="mt-6 text-center">
        <p className="text-sm mb-1">Scan this to preview or claim:</p>
        <QRCode
          value={claimUrl}
          size={128}
          style={{ height: 'auto', maxWidth: '128px', width: '128px' }}
          viewBox={`0 0 128 128`}
        />
      </div>

      {logs.length > 0 && (
        <div className="mt-6 border-t pt-4 text-xs">
          <h2 className="font-bold text-gray-600 mb-2">Recent Activity</h2>
          <ul className="text-gray-700">
            {logs.map((log, idx) => (
              <li key={idx}>
                [{new Date(log.timestamp).toLocaleString()}] {log.action_type} by{' '}
                {log.triggered_by || '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  ) : (
    <p className="p-6">Loading...</p>
  );
}
