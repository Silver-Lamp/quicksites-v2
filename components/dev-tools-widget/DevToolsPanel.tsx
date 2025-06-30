// components/dev-tools-widget/DevToolsPanel.tsx
'use client';

type Props = {
  layout: 'compact' | 'cozy' | 'debug';
  toggleLayout: () => void;
};

export function DevToolsPanel({ layout, toggleLayout }: Props) {
  return (
    <div className="font-semibold text-white mb-1 flex justify-between items-center">
      <span>Developer Tools</span>
      <button onClick={toggleLayout} className="text-xs text-blue-300 underline">{layout}</button>
    </div>
  );
}
