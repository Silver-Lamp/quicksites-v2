// ✅ FILE: pages/index.tsx

import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';

export async function getServerSideProps(context) {
  const supabase = createPagesServerClient(context);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const role = session?.user?.user_metadata?.role;

  if (role && ['admin', 'owner', 'reseller'].includes(role)) {
    return {
      redirect: {
        destination: '/admin/dashboard',
        permanent: false,
      },
    };
  }

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
