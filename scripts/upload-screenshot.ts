import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function uploadScreenshot(domain: string, filePath: string) {
  const buffer = await import('fs/promises').then(fs => fs.readFile(filePath));
  const fileName = `${domain}.png`;
  const { error } = await supabase.storage.from('screenshots').upload(fileName, buffer, {
    upsert: true,
    contentType: 'image/png',
  });
  return error;
}
