import AdminSidebarLayout from '@/components/admin/layout/AdminSidebarLayout';

function BrandingPage() {
  return <h1 className="text-xl font-bold">Branding Themes</h1>;
}

BrandingPage.getLayout = (page: React.ReactNode) => (
  <AdminSidebarLayout>{page}</AdminSidebarLayout>
);

export default BrandingPage;
