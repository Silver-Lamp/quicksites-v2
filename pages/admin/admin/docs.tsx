import fs from 'fs';
import path from 'path';
import { useEffect, useState } from 'react';

export default function DocsPage() {
  const [html, setHtml] = useState('');

  useEffect(() => {
    fetch('/api/readme')
      .then((res) => res.text())
      .then(setHtml);
  }, []);

  return (
    <div className="prose mx-auto max-w-4xl p-6">
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
