// ✅ FILE: pages/index.tsx

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export async function getServerSideProps(context) {
  const supabase = createPagesServerClient(context);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const role = session?.user?.user_metadata?.role;

  console.log('🔒 [Index] Role', { role });
  console.log('🔒 [Index] Session', { session });
  console.log('🔒 [Index] User', { user: session?.user });
  console.log('🔒 [Index] User Metadata', { userMetadata: session?.user?.user_metadata });
  console.log('🔒 [Index] User Role', { userRole: session?.user?.user_metadata?.role });
  console.log('🔒 [Index] User Roles', { userRoles: session?.user?.user_metadata?.roles });
  console.log('🔒 [Index] User Role', { userRole: session?.user?.user_metadata?.role });

  const skipRoleCheck = true;
  if (skipRoleCheck) {
    console.log('🔒 [Index] Skipping role check', { skipRoleCheck });
    return {
      redirect: {
        destination: '/admin/dashboard',
        permanent: false,
      },
    };
  }

  if (role && ['admin', 'owner', 'reseller'].includes(role)) {
    console.log('🔒 [Index] Redirecting to admin dashboard', { role });
    return {
      redirect: {
        destination: '/admin/dashboard',
        permanent: false,
      },
    };
  }

  console.log('🔒 [Index] Redirecting to login', { role });
    return {
    props: {},
  };
}

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-black">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Welcome to QuickSites</h1>
        <p className="text-gray-400">You are signed in but do not have an elevated role yet.</p>
        <a href="/login" className="text-blue-500 underline">Return to login</a>
      </div>
    </div>
  );
}
