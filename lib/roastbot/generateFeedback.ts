import type { Block } from '@/types/blocks';
import { suggestFix } from './suggestFix';

export type FeedbackMode = 'roast' | 'fix' | 'none';

export async function getRoastForBlock(block: Block): Promise<string> {
  return generateFeedback({
    type: block.type,
    content: block.content,
    mode: 'roast',
  });
}

export function getFixForBlock(block: Block): Partial<Block['content']> {
  return suggestFix(block);
}

export async function generateFeedback({
  type,
  content,
  mode = 'roast',
}: {
  type: string;
  content: any;
  mode?: FeedbackMode;
}): Promise<string> {
  // 🔥 GPT roast prompt builder
  const system = `You are RoastBot, an AI who roasts UI blocks with increasing severity.`;

  const input = `
Block type: ${type}
Block content: ${JSON.stringify(content, null, 2)}
Feedback mode: ${mode}

Give a short, funny roast based on the block’s purpose and content.
Avoid repeating the block’s text exactly.
Max 1 sentence.
`;

  const res = await fetch('/api/roast', {
    method: 'POST',
    body: JSON.stringify({ system, input }),
    headers: { 'Content-Type': 'application/json' },
  });

  const { roast } = await res.json();
  return roast || "It's fine. I guess.";
}
