import { GetServerSideProps } from 'next';
import { supabase } from '@/lib/supabaseClient';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import QRCode from 'react-qr-code';

export default function PublishTemplate({
  initialDomain,
  template_name,
}: {
  initialDomain: string;
  template_name: string;
}) {
  const [domain, setDomain] = useState(initialDomain);
  const [status, setStatus] = useState('idle');

  const handlePublish = async () => {
    const res = await fetch('/api/templates/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_name, domain }),
    });
    if (res.ok) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">Publish Template: {template_name}</h1>
      <Input
        placeholder="e.g. demo.quicksite.io/my-tow"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        className="mb-4"
      />
      <Button onClick={handlePublish} disabled={!domain}>
        Publish
      </Button>
      {domain && (
        <div className="mt-4">
          <p className="text-sm mb-2">Scan to view live site:</p>
          <QRCode
            value={`https://yourdomain.com/sites/${domain}`}
            size={128}
            style={{ height: 'auto', maxWidth: '128px', width: '128px' }}
            viewBox={`0 0 128 128`}
          />
        </div>
      )}
      {status === 'success' && (
        <p className="text-green-600 text-sm mt-2">✅ Template published to {domain}</p>
      )}
      {status === 'error' && (
        <p className="text-red-600 text-sm mt-2">❌ Failed to publish template</p>
      )}
    </div>
  );
}
