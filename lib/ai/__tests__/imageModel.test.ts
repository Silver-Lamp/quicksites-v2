/**
 * @jest-environment node
 */
// OpenAI retired gpt-image-1 (2026-10-23: "The model 'gpt-image-1' does not exist."), and it was
// typed into fifteen files. Every image call now names IMAGE_MODEL; this fails if a literal model
// string comes back in app/ or lib/.
import { execSync } from 'child_process';
import { IMAGE_MODEL } from '@/lib/ai/imageModel';

it('no code passes a literal image model; IMAGE_MODEL is the one name', () => {
  const hits = execSync(
    `git grep -nE "model(_code)?\\s*:\\s*'gpt-image-[0-9.]+'" -- app lib ':!**/__tests__/**' || true`,
    { encoding: 'utf8' },
  ).trim();
  expect(hits).toBe('');
  expect(IMAGE_MODEL).not.toBe('gpt-image-1');
});
