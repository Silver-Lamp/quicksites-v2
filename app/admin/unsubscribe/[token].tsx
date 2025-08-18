import { GetServerSideProps } from 'next';
import { supabase } from '@/lib/supabase/client';

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
