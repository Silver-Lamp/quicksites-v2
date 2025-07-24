import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const buffer = Buffer.from(await req.arrayBuffer());
  const templateId = new URL(req.url).searchParams.get('templateId');
  if (!templateId) return new NextResponse('Missing templateId', { status: 400 });

  try {
    const resized = await sharp(buffer).resize(64, 64).png().toBuffer();
    // const ico = await sharp(buffer).resize(64, 64).toFormat('ico').toBuffer();

    const pngPath = `favicons/${templateId}/favicon.png`;
    // const icoPath = `favicons/${templateId}/favicon.ico`;

    const { error: pngError } = await supabase.storage
      .from('public')
      .upload(pngPath, resized, { contentType: 'image/png', upsert: true });

    // const { error: icoError } = await supabase.storage
    //   .from('public')
    //   .upload(icoPath, ico, { contentType: 'image/x-icon', upsert: true });

    // if (pngError || icoError) {
    if (pngError) {
      return new NextResponse('Upload failed', { status: 500 });
    }

    const { data: publicUrl } = supabase.storage.from('public').getPublicUrl(pngPath);

    await supabase
      .from('templates')
      .update({ logo_url: publicUrl.publicUrl }) // auto-link to metadata
      .eq('id', templateId);

    return NextResponse.json({
      success: true,
      png: publicUrl.publicUrl,
      // ico: supabase.storage.from('public').getPublicUrl(icoPath).data.publicUrl,
    });
  } catch (err) {
    console.error('Favicon optimization failed:', err);
    return new NextResponse('Error optimizing image', { status: 500 });
  }
}
