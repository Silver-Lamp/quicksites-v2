'use client';

import { useEffect, useState } from 'react';

export default function QueryUsecasesPage() {
  const [usecases, setUsecases] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/query-usecases')
      .then((res) => res.json())
      .then((data) => setUsecases(data.files || []));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">📚 Query Usecases</h1>
      <ul className="list-disc ml-6">
        {usecases.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
    </div>
  );
}
