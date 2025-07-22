export type FeedbackMode = 'roast' | 'truth';
export type RoastLevel = 'mild' | 'medium' | 'scorched';

export async function generateFeedback({
  type,
  content,
  mode = 'roast',
  level = 'medium',
}: {
  type: string;
  content: any;
  mode?: FeedbackMode;
  level?: RoastLevel;
}): Promise<string> {
  const system =
    mode === 'roast'
      ? `You are RoastBot, an AI that critiques UI blocks with humor.`
      : `You are UXBot, a serious UI/UX expert. Give direct, constructive feedback.`;

  const input = `
Block type: ${type}
Block content: ${JSON.stringify(content, null, 2)}
${mode === 'roast' ? `Roast level: ${level}` : ''}

Give a ${mode === 'truth' ? 'concise, serious UX critique' : 'funny, 1-sentence roast'}.
Avoid repeating block text verbatim.
`;

  const res = await fetch('/api/roast', {
    method: 'POST',
    body: JSON.stringify({ system, input }),
    headers: { 'Content-Type': 'application/json' },
  });

  const { roast } = await res.json();
  return roast || "No feedback returned.";
}
