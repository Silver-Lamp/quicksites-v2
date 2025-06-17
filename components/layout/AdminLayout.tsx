import AppHeader from '@/components/admin/AppHeader/AppHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <AppHeader />
      <main>{children}</main>
    </div>
  );
}
