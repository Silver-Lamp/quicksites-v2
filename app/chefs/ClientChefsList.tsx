'use client';

import ChefsList from '@/components/public/chefs-list';

export default function ClientChefsList({ slug, showSearch = true }: { slug: string; showSearch?: boolean }) {
  return <ChefsList slug={slug} showSearch={showSearch} />;
}
