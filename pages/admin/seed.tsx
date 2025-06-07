'use client';
import { useState } from 'react';

export default function SeedUploadPage() {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState('');
  const [data, setData] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSubmit = async () => {
    setStatus('saving');
    await fetch('/api/admin/seed-template', {
      method: 'POST',
      body: JSON.stringify({ id, name, description: desc, template_id: templateId, preview, data }),
    });
    setStatus('saved');
  };

  return (
    <div className="p-6 max-w-xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">🌱 Seed a Starter Template</h1>

      <input className="w-full p-2 mb-2 bg-zinc-800 rounded" placeholder="ID" value={id} onChange={(e) => setId(e.target.value)} />
      <input className="w-full p-2 mb-2 bg-zinc-800 rounded" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full p-2 mb-2 bg-zinc-800 rounded" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <input className="w-full p-2 mb-2 bg-zinc-800 rounded" placeholder="Template ID" value={templateId} onChange={(e) => setTemplateId(e.target.value)} />
      <input className="w-full p-2 mb-2 bg-zinc-800 rounded" placeholder="Preview Filename" value={preview} onChange={(e) => setPreview(e.target.value)} />
      <textarea className="w-full p-2 mb-4 h-32 bg-zinc-800 rounded" placeholder="JSON Data" value={data} onChange={(e) => setData(e.target.value)} />

      <button onClick={handleSubmit} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
        {status === 'saving' ? 'Saving…' : status === 'saved' ? '✅ Saved!' : 'Submit'}
      </button>
    </div>
  );
}
