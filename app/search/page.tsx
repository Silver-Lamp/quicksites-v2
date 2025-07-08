// app/search/page.tsx
import { useSearchQuery } from '@/lib/querySchemas/search';

export default function SearchPage() {
  const { params, setParam, clearParam } = useSearchQuery();

  return (
    <>
      <p>Page: {params.page}</p>
      <button onClick={() => setParam('page', params.page + 1)}>Next</button>
      <button onClick={() => clearParam('tags')}>Clear Tags</button>
    </>
  );
}
