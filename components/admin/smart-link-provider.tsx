import { SmartLinkContext } from './smart-link-context';
import { useSmartLinkPersisted } from './use-smart-link-persisted';
import { ReactNode } from 'react';

export function SmartLinkProvider({ children }: { children: ReactNode }) {
  const { theme: defaultTheme, query: defaultQuery } = useSmartLinkPersisted();

  return (
    <SmartLinkContext.Provider value={{ defaultTheme, defaultQuery }}>
      {children}
    </SmartLinkContext.Provider>
  );
}
