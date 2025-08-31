// import SeedAllPanel from '@/components/admin/dev/seed-all-panel';
import SeedAllPanel from '@/components/admin/dev/seeder/SeedAllPanel';
import ResetStoragePanel from '@/components/admin/dev/reset-storage-panel';

export default function DevPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Developer Tools</h1>
      <SeedAllPanel />
      <ResetStoragePanel />
    </div>
  );
}
