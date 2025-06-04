import dynamic from 'next/dynamic';

const DynamicMap = dynamic(() => import('../components/GridMap'), { ssr: false });

export default function TheGrid() {
  return (
    <div className="p-6 text-white">
      <DynamicMap />
    </div>
  );
}
