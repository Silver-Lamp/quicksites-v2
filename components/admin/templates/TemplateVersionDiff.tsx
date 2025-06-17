import { useEffect, useState } from 'react';
import { diff } from 'jsondiffpatch';

// @ts-ignore
import * as htmlFormatter from 'jsondiffpatch/formatters/html';

export default function TemplateVersionDiff({
  current,
  previous,
}: {
  current: any;
  previous: any;
}) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    const delta = diff(previous, current);
    if (!delta) {
      setHtml(null);
      return;
    }
    const result = htmlFormatter.format(delta, previous);
    setHtml(result);
  }, [current, previous]);

  return (
    <div className="p-4 rounded bg-white dark:bg-gray-800 text-sm overflow-auto border border-gray-700">
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="text-gray-400">No changes detected</p>
      )}
    </div>
  );
}
