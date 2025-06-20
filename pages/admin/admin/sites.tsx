import AdminSidebarLayout from '@/components/admin/layout/admin-sidebar-layout';

function SitesPage() {
  return <h1 className="text-xl font-bold">Sites Index</h1>;
}

SitesPage.getLayout = (page: React.ReactNode) => <AdminSidebarLayout>{page}</AdminSidebarLayout>;

export default SitesPage;
