'use client';
import { useState } from 'react';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState('');

  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append('file', file);

    const res = await fetch('/api/admin/upload-template-image', {
      method: 'POST',
      body: form,
    });

    if (res.ok) {
      setMsg('✅ Uploaded!');
    } else {
      setMsg('❌ Upload failed');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto text-white">
      <h1 className="text-xl font-bold mb-4">🖼 Upload Template Screenshot</h1>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4" />
      <button onClick={upload} className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700">
        Upload
      </button>
      {msg && <p className="mt-3">{msg}</p>}
    </div>
  );
}
