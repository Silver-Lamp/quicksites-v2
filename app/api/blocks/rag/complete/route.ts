import { NextRequest, NextResponse } from 'next/server';
import { ChromaClient } from 'chromadb';
import { DefaultEmbeddingFunction } from '@chroma-core/default-embed';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const chroma = new ChromaClient({
  path: './chroma-store',
});

const collectionPromise = chroma.getOrCreateCollection({
  name: 'quicksite_blocks',
  embeddingFunction: new DefaultEmbeddingFunction(),
});

export async function POST(req: NextRequest) {
  const { userPrompt, originalText, blockType, industry, tone = 'neutral' } = await req.json();

  if (!userPrompt || !originalText || !blockType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    const collection = await collectionPromise;

    // Step 1: Vector search for similar blocks
    const filter = { type: blockType, industry, tone };
    const result = await collection.query({
      queryTexts: [userPrompt],
      nResults: 5,
      where: filter,
    });

    const examples = result.documents?.[0] || [];

    // Step 2: Build prompt
    const prompt = `
You are a website content generator. Your task is to rewrite the following block to meet the user's request.

User Prompt: "${userPrompt}"

Here are examples of similar blocks:
${examples.map((ex, i) => `Example ${i + 1}: ${ex}`).join('\n\n')}

Original Block:
"${originalText}"

Please rewrite it below:
`;

    // Step 3: Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const rewritten = response.choices[0].message.content?.trim() || '';

    return NextResponse.json({ rewritten });
  } catch (err: any) {
    console.error('🔥 RAG error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
