// app/projects/page.tsx
'use client';

import { useProjectQuery } from '@/lib/querySchemas/projects';

export default function ProjectsPage() {
  const { params, setParam, clearParam } = useProjectQuery();

  return (
    <main>
      <h1>Projects ({params.status})</h1>
      {params.team && <p>Team: {params.team}</p>}
      <p>Page: {params.page}</p>

      <button onClick={() => setParam('status', 'archived')}>Show Archived</button>
      <button onClick={() => clearParam('team')}>Clear Team</button>
    </main>
  );
}
