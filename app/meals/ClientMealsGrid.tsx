'use client';

import PublicMealsGrid from '@/components/public/public-meals-grid';

export default function ClientMealsGrid({ slug }: { slug: string }) {
  return <PublicMealsGrid slug={slug} />;
}
