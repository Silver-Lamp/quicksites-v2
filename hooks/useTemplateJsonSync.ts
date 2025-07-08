// hooks/useTemplateJsonSync.ts
import { useEffect, useState } from 'react';
import type { TemplateData } from '@/types/template';

export function useTemplateJsonSync(data: TemplateData) {
  const [rawJson, setRawJson] = useState(() => JSON.stringify(data, null, 2));
  const [livePreviewData, setLivePreviewData] = useState<TemplateData>(data);

  useEffect(() => {
    setRawJson(JSON.stringify(data, null, 2));
  }, [data]);

  useEffect(() => {
    try {
      const parsed = JSON.parse(rawJson);
      setLivePreviewData(parsed);
    } catch {
      // ignore
    }
  }, [rawJson]);

  return {
    rawJson,
    setRawJson,
    livePreviewData,
  };
}
