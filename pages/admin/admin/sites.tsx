import AdminSidebarLayout from '@/components/layout/AdminSidebarLayout';

function SitesPage() {
  return <h1 className="text-xl font-bold">Sites Index</h1>;
}

SitesPage.getLayout = (page: React.ReactNode) => (
  <AdminSidebarLayout>{page}</AdminSidebarLayout>
);

export default SitesPage;
