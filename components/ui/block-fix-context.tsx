'use client';

import { createContext, useContext, useState } from 'react';
import type { Block } from '@/types/blocks';

type FixMap = Record<string, Partial<Block['content']>>;
type BlockFixMap = Record<string, Partial<Block['content']>>;

type BlockFixContextType = {
  draftFixes: FixMap;
  committedFixes: FixMap;
  enabled: boolean;
  toggle: () => void;
  setDraftFix: (id: string, patch: Partial<Block['content']>) => void;
  discardFix: (id: string) => void;
  commitFix: (id: string) => void;
  resetAll: () => void;
};

const BlockFixContext = createContext<BlockFixContextType>({
  draftFixes: {},
  committedFixes: {},
  enabled: false,
  toggle: () => {},
  setDraftFix: () => {},
  discardFix: () => {},
  commitFix: () => {},
  resetAll: () => {},
});

export function BlockFixProvider({ children }: { children: React.ReactNode }) {
  const [draftFixes, setDraftFixes] = useState<FixMap>({});
  const [committedFixes, setCommittedFixes] = useState<FixMap>({});
  const [enabled, setEnabled] = useState(false);

  const setDraftFix = (id: string, patch: Partial<Block['content']>) => {
    setDraftFixes((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch } as BlockFixMap[string],
    }));
  };

  const discardFix = (id: string) => {
    setDraftFixes((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  };

  const commitFix = (id: string) => {
    if (draftFixes[id]) {
      setCommittedFixes((prev) => ({
        ...prev,
        [id]: draftFixes[id],
      }));
    }
  };

  const resetAll = () => {
    setDraftFixes({});
    setCommittedFixes({});
    setEnabled(false);
  };

  return (
    <BlockFixContext.Provider
      value={{
        draftFixes,
        committedFixes,
        enabled,
        toggle: () => setEnabled((v) => !v),
        setDraftFix,
        discardFix,
        commitFix,
        resetAll,
      }}
    >
      {children}
    </BlockFixContext.Provider>
  );
}

export const useBlockFix = () => useContext(BlockFixContext);
