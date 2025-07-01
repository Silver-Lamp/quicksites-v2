// components/dev-tools-widget/DevToolsPanel.tsx
'use client';

type Props = {
//   layout: 'compact' | 'cozy' | 'debug';
//   toggleLayout: () => void;
  minimized: boolean;
};

export function DevToolsPanel({ minimized = true }: Props) {
  return (
    <div className="font-semibold text-white mb-1 flex justify-between items-center">
      <span>Developer Tools</span>
      {/* {!minimized && (
        <button onClick={toggleLayout} className="text-xs text-blue-300 underline">
          {layout}
        </button>
      )} */}
    </div>
  );
}
