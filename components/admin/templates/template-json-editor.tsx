// ✅ FILE: components/admin/templates/template-json-editor.tsx (fixed quotes)
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { JsonValue } from '@/types/json';

type TemplateJsonEditorProps = {
  rawJson: string;
  setRawJson: (value: string) => void;
};

export default function TemplateJsonEditor({ rawJson, setRawJson }: TemplateJsonEditorProps) {
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [parsedJson, setParsedJson] = useState(null);
  const [collapsed, setCollapsed] = useState(new Set<string>());

  useEffect(() => {
    try {
      const parsed = JSON.parse(rawJson);
      setParsedJson(parsed);
    } catch {
      setParsedJson(null);
    }
  }, [rawJson]);

  const toggleCollapse = (path: string) => {
    const newSet = new Set(collapsed);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    setCollapsed(newSet);
  };

  const renderValue = (value: JsonValue, path = '') => {
    const type = typeof value;

    if (value === null) return <span className="text-pink-400">null</span>;
    if (Array.isArray(value)) {
      const isCollapsed = collapsed.has(path);
      return (
        <div>
          <span className="cursor-pointer select-none" onClick={() => toggleCollapse(path)}>
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <span className="text-yellow-400"> [Array]</span>
          </span>
          {!isCollapsed && (
            <div className="ml-4">
              {value.map((v, i) => (
                <div key={i}>{renderValue(v, `${path}[${i}]`)}</div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === 'object') {
      const isCollapsed = collapsed.has(path);
      return (
        <div>
          <span className="cursor-pointer select-none" onClick={() => toggleCollapse(path)}>
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            <span className="text-blue-400"> {'{Object}'} </span>
          </span>
          {!isCollapsed && (
            <div className="ml-4">
              {Object.entries(value).map(([k, v]) => (
                <div key={k}>
                  <span className="text-green-400">&quot;{k}&quot;</span>:{' '}
                  {renderValue(v, `${path}.${k}`)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (type === 'string')
      return <span className="text-emerald-400">&quot;{value as string}&quot;</span>;
    if (type === 'number') return <span className="text-cyan-400">{value as number}</span>;
    if (type === 'boolean')
      return <span className="text-orange-400">{(value as boolean).toString()}</span>;
    return <span className="text-white">{value as string}</span>;
  };

  const handlePrettify = () => {
    try {
      const parsed = JSON.parse(rawJson);
      setRawJson(JSON.stringify(parsed, null, 2));
    } catch {
      alert('Invalid JSON. Cannot format.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <h3 className="text-white text-sm font-semibold">JSON Editor</h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handlePrettify}>
            Prettify
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsReadOnly(!isReadOnly)}>
            {isReadOnly ? 'Unlock' : 'Read-Only'}
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded border border-gray-700 bg-gray-900 font-mono text-sm text-white max-h-[500px] p-4">
        {isReadOnly ? (
          parsedJson ? (
            renderValue(parsedJson)
          ) : (
            <pre>{rawJson}</pre>
          )
        ) : (
          <textarea
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            className="w-full h-[600px] resize-none bg-gray-900 text-white font-mono text-sm p-2 border border-gray-700 rounded"
          />
        )}
      </div>
    </div>
  );
}
