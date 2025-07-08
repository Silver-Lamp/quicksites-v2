import type { Block } from '@/types/blocks';

// Extract the content type for each Block variant
type BlockContentByType = {
  [B in Block as B['type']]: B extends { content: infer C } ? C : never;
};

// Restrict keys to valid block types
type BlockTypeKey = keyof BlockContentByType;

// Utility function to narrow block content
export function getContent<T extends BlockTypeKey>(
  block: Block,
  expected: T
): BlockContentByType[T] {
  if (block.type === expected) {
    return block.content as BlockContentByType[T];
  }
  return {} as BlockContentByType[T];
}
