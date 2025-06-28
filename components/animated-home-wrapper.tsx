'use client';

import dynamic from 'next/dynamic';

const AnimatedHome = dynamic(() => import('@/components/animated-home'), {
  ssr: false,
});

export default function AnimatedHomeClientWrapper() {
  return <AnimatedHome />;
}
