import React from 'react';
import dynamic from 'next/dynamic';

const ClientList = dynamic(() => import('./reviews-list.client'), { ssr: false });

type Props = {
  mealId?: string;
  chefId?: string;
  siteId?: string;
  pageSize?: number;
  sort?: 'recent'|'top';
  minStars?: number;
  showSummary?: boolean;
  showWriteCta?: boolean;
};

async function fetchInitial(props: Props) {
  const params = new URLSearchParams();
  if (props.mealId) params.set('meal_id', props.mealId);
  if (props.chefId) params.set('chef_id', props.chefId);
  if (props.siteId) params.set('site_id', props.siteId);
  if (props.pageSize) params.set('limit', String(props.pageSize));
  if (props.sort) params.set('sort', props.sort);
  if (props.minStars) params.set('min_stars', String(props.minStars));
  params.set('include_summary', '1');

  const res = await fetch(`/api/public/reviews?${params.toString()}`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to load reviews');
  return res.json();
}

export default async function ReviewsListSSR(props: Props) {
  const pageSize = props.pageSize ?? 6;
  const data = await fetchInitial(props);
  return (
    <ClientList
      initial={data}
      pageSize={pageSize}
      query={{ mealId: props.mealId, chefId: props.chefId, siteId: props.siteId, sort: props.sort, minStars: props.minStars }}
      showSummary={props.showSummary !== false}
      showWriteCta={props.showWriteCta === true}
    />
  );
}
