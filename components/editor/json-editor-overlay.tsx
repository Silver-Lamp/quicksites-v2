// components/editor/JsonEditorOverlay.tsx
'use client';
import { X } from 'lucide-react';
import TemplateJsonEditor from '@/components/admin/templates/template-json-editor';

export function JsonEditorOverlay({ rawJson, setRawJson, onClose }: { rawJson: string; setRawJson: (v: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto p-8">
      <div className="text-white flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">JSON Editor</h2>
        <button onClick={onClose}><X size={20} className="text-white" /></button>
      </div>
      <TemplateJsonEditor rawJson={rawJson} setRawJson={setRawJson} />
    </div>
  );
}
