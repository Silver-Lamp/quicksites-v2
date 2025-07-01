'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const CheckinMap = dynamic(() => import('@/components/checkin-map'), { ssr: false });

export default function CheckinMapPage() {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    fetch('/api/checkin-map')
      .then((res) => res.json())
      .then(setPoints);
  }, []);

  return (
    <div className="w-full h-screen">
      <CheckinMap points={points} />
    </div>
  );
}
