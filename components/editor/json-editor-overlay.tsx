// components/editor/json-editor-overlay.tsx
'use client';
import { X } from 'lucide-react';
import TemplateJsonEditor from '@/components/admin/templates/template-json-editor';
import ClientOnly from '../client-only';

export function JsonEditorOverlay({ rawJson, setRawJson, onClose, sidebarValues, setSidebarValues }: { rawJson: string; setRawJson: (v: string) => void; onClose: () => void; sidebarValues: any; setSidebarValues: (v: any) => void }) {
  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto p-8">
      <div className="text-white flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">JSON Editor</h2>
        <button onClick={onClose}><X size={20} className="text-white" /></button>
      </div>
      <ClientOnly>
        <TemplateJsonEditor rawJson={rawJson} setRawJson={setRawJson} colorMode="dark" sidebarValues={sidebarValues} setSidebarValues={setSidebarValues} />
      </ClientOnly>
    </div>
  );
}
