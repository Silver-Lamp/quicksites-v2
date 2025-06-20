import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { withInputValidation } from '../../../lib/api/validation.js';
import { json } from '../../../lib/api/json.js';

export const runtime = 'edge';

const DeleteInputSchema = z.object({
  name: z.string().min(1, 'Missing file name'),
});

const handler = withInputValidation(
  DeleteInputSchema as any,
  async (input: any): Promise<Response> => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.storage.from('campaign-ogs').remove([input.name]);

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    return json({ success: true });
  }
);

export const POST = handler;
