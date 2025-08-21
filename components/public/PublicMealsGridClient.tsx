'use client';

import dynamic from 'next/dynamic';

// Client-only wrapper so we can use ssr:false safely
const PublicMealsGrid = dynamic(() => import('@/components/public/public-meals-grid'), {
  ssr: false,
});

export default PublicMealsGrid;
