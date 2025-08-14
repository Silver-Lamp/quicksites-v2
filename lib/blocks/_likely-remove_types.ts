import { JSX } from 'react';

export type BlockAny = {
    id: string;
    type: string;
    version: number;
    props: any;
  };
  
  export type BlockDef<TProps = any> = {
    type: string;
    version: number;           // bump when props change; supply migrate()
    Component: (args: { props: TProps }) => Promise<JSX.Element> | JSX.Element;
    migrate?: (oldProps: any, fromVersion: number) => TProps; // optional
    validate?: (props: any) => { ok: true } | { ok: false; error: string };
    ssr?: boolean;             // true = server component (default)
  };
  