'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { Monitor, Smartphone, Tablet, RotateCw, Eye, EyeOff } from 'lucide-react';

type Mode = 'mobile' | 'tablet' | 'desktop';
type Orientation = 'portrait' | 'landscape';
type Theme = 'light' | 'dark';

const showBezel = false;

export default function DevicePreviewWrapper({
  children,
  showDebug = false,
  theme = 'dark',
}: {
  children: React.ReactNode;
  showDebug?: boolean;
  theme?: Theme;
}) {
  const [mode, setMode] = useState<Mode>('desktop');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [showInspector, setShowInspector] = useState(showDebug);
  const previewRef = useRef<HTMLDivElement>(null);
  const [classList, setClassList] = useState<string>('');
  const [bgColor, setBgColor] = useState<string>('');

  useEffect(() => {
    const el = previewRef.current;
    if (el) {
      setClassList(el.className);
      const style = getComputedStyle(el);
      setBgColor(style.backgroundColor);
    }
  });

  const renderIcon = (target: Mode) => {
    if (target === 'mobile') return <Smartphone size={14} />;
    if (target === 'tablet') return <Tablet size={14} />;
    return <Monitor size={14} />;
  };

  const getSizeClass = (mode: Mode, orientation: Orientation) => {
    const sizes = {
      mobile: {
        portrait: 'w-[375px] h-[667px]',
        landscape: 'w-[667px] h-[375px]',
      },
      tablet: {
        portrait: 'w-[768px] h-[1024px]',
        landscape: 'w-[1024px] h-[768px]',
      },
      desktop: {
        default: 'w-[1024px] h-auto',
      },
    };
    return mode === 'desktop' ? sizes.desktop.default : sizes[mode][orientation];
  };

  const bezelFrame = (content: React.ReactNode) => {
    if (mode === 'desktop') return content;

    return (
      <div className="relative w-fit">
        {showBezel && (
          <svg
            className="absolute inset-0 z-10 pointer-events-none"
            width="100%"
            height="100%"
            viewBox="0 0 400 800"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect
              x="10"
              y="10"
              width="380"
              height="780"
              rx="40"
              ry="40"
              fill="none"
              stroke="#999"
              strokeWidth="20"
            />
          </svg>
        )}
        <div
          className={`z-0 relative ${getSizeClass(mode, orientation)}`}
          id="preview-target"
          style={{ border: 'none', boxShadow: 'none' }}
        >
          <div
            id="preview-capture"
            ref={previewRef}
            className={`w-full h-full overflow-y-auto p-4 transition-colors ${
              theme === 'dark'
                ? 'bg-neutral-900 text-white'
                : 'bg-transparent text-black'
            }`}
          >
            {showInspector && (
              <div className="text-xs mb-3 px-3 py-2 rounded border bg-yellow-100 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-500 font-mono">
                <div className="mb-1 font-semibold">#preview-capture Debug</div>
                <div><strong>Theme:</strong> {theme}</div>
                <div><strong>class:</strong> {classList}</div>
                <div className="flex items-center gap-2">
                  <strong>background:</strong>
                  <span
                    className="inline-block w-4 h-4 rounded border border-gray-300"
                    style={{ backgroundColor: bgColor }}
                  />
                  <code>{bgColor}</code>
                </div>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-start gap-2 flex-wrap">
        {(['mobile', 'tablet', 'desktop'] as Mode[]).map((opt) => (
          <Button
            key={opt}
            onClick={() => setMode(opt)}
            size="sm"
            variant={mode === opt ? 'default' : 'secondary'}
            className="flex items-center gap-2"
          >
            {renderIcon(opt)} {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </Button>
        ))}

        {(mode === 'mobile' || mode === 'tablet') && (
          <Button
            onClick={() =>
              setOrientation((prev) => (prev === 'portrait' ? 'landscape' : 'portrait'))
            }
            size="sm"
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RotateCw size={14} /> {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
          </Button>
        )}

        {showDebug && (
          <Button
            onClick={() => setShowInspector((prev) => !prev)}
            size="sm"
            variant="outline"
            className="flex items-center gap-2"
          >
            {showInspector ? <EyeOff size={14} /> : <Eye size={14} />} Debug
          </Button>
        )}
      </div>

      <div className="mt-0">{bezelFrame(<>{children}</>)}</div>
    </div>
  );
}
