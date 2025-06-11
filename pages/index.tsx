// ✅ FILE: pages/index.tsx

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export async function getServerSideProps(context: any) {
  const supabase = createPagesServerClient(context);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const roleMetadata = session?.user?.user_metadata?.role;

  console.log('🔒 [Index] Role (metadata)', { roleMetadata });
  console.log('🔒 [Index] Session', { session });
  console.log('🔒 [Index] User', { user: session?.user });
  console.log('🔒 [Index] User Metadata', { userMetadata: session?.user?.user_metadata });
  console.log('🔒 [Index] User Role (metadata)', { userRole: session?.user?.user_metadata?.role });
  console.log('🔒 [Index] User Roles (metadata)', { userRoles: session?.user?.user_metadata?.roles });

  if (roleMetadata && ['admin', 'owner', 'reseller'].includes(roleMetadata)) {
    const skipRedirect = true;
    if (skipRedirect) {
      console.log('🔒 [Index] Skipping redirect to admin dashboard', { skipRedirect });
      return {
        props: {},
      };
    }
    console.log('🔄 [Index] Redirecting to admin dashboard', { roleMetadata });
    return {
      redirect: {
        destination: '/admin/dashboard',
        permanent: false,
      },
    };
  }

  const skipRedirect = true;
  if (skipRedirect) {
    console.log('🔒 [Index] Skipping redirect to login', { skipRedirect });
    return {
      props: {},
    };
  }
  console.log('🔄 [Index] Redirecting to login', { roleMetadata });
  return {
    redirect: {
      destination: '/login',
      permanent: false,
    },
  };
}

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-black">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Welcome to QuickSites</h1>
      </div>
    </div>
  );
}
