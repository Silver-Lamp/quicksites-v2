import { normalizeOpenAiSize, OpenAISize } from "@/lib/images/normalizeOpenAiSize";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// app/api/chef/profile/generate-avatar/route.ts
export async function POST(req: Request) {
    try {
    if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
    }
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase server credentials' }, { status: 500 });
    }
    
    
    const body = (await req.json().catch(() => ({}))) as {
    displayName?: string;
    cuisine?: string;
    vibe?: string;
    size?: string;
    };
    
    
    // Coerce any provided size to a valid one; default square for avatars.
    const size: OpenAISize = normalizeOpenAiSize(body?.size, 'avatar'); // → 1024x1024
    
    
    const prompt = [
    'Professional chef profile avatar for delivered.menu.',
    'Square crop, natural lighting, neutral background, friendly expression.',
    body.cuisine ? `Cuisine focus: ${body.cuisine}.` : '',
    body.vibe ? `Style vibe: ${body.vibe}.` : '',
    'No text, no watermark, photographic realism.'
    ].filter(Boolean).join(' ');
    
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    
    
    const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    size,
    });
    
    
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ error: 'Image generation failed' }, { status: 502 });
    
    
    // Upload to Supabase Storage
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const id = randomUUID();
    const path = `profiles/ai-avatars/${id}.png`;
    
    
    const { error: upErr } = await supabase.storage
    .from(process.env.PROFILE_IMAGES_BUCKET!)
    .upload(path, Buffer.from(b64, 'base64'), {
    upsert: false,
    contentType: 'image/png',
    });
    
    
    if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }
    
    
    const { data: pub } = supabase.storage.from(process.env.PROFILE_IMAGES_BUCKET!).getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl, size });
    } catch (e: any) {
    const msg = String(e?.message || e);
    // Friendlier hint if a legacy size slipped through anywhere
    if (msg.includes("Invalid value: '512x512'")) {
    return NextResponse.json({
    error: "OpenAI images now require 1024x1024, 1024x1536, 1536x1024, or 'auto'.",
    }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
    }
    }