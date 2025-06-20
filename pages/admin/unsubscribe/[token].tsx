import { GetServerSideProps } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function UnsubscribePage({ success }: { success: boolean }) {
  return (
    <div className="max-w-xl mx-auto p-6 text-center">
      <h1 className="text-2xl font-bold mb-2">Unsubscribe</h1>
      {success ? (
        <p className="text-green-600">✅ You’ve been unsubscribed successfully.</p>
      ) : (
        <p className="text-red-600">❌ We couldn’t process your unsubscribe request.</p>
      )}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.params?.token as string;

  const { error } = await supabase.from('subscriptions').delete().eq('unsubscribe_token', token);

  return {
    props: {
      success: !error,
    },
  };
};
