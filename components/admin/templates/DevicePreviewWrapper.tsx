import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, Tablet, RotateCw } from 'lucide-react';

type Mode = 'mobile' | 'tablet' | 'desktop';
type Orientation = 'portrait' | 'landscape';

export default function DevicePreviewWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<Mode>('mobile');
  const [orientation, setOrientation] = useState<Orientation>('portrait');

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
    return mode === 'desktop'
      ? sizes.desktop.default
      : sizes[mode][orientation];
  };

  const bezelFrame = (content: React.ReactNode) => {
    if (mode === 'desktop') return content;

    return (
      <div className="relative w-fit">
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
        <div
          className={`z-0 relative rounded-md overflow-hidden ${getSizeClass(mode, orientation)}`}
          id="preview-target"
        >
          <div
            id="preview-capture"
            className="bg-white dark:bg-gray-900 w-full h-full overflow-y-auto p-4"
          >
            {content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 flex-wrap">
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
              setOrientation((prev) =>
                prev === 'portrait' ? 'landscape' : 'portrait'
              )
            }
            size="sm"
            variant="secondary"
            className="flex items-center gap-2"
          >
            <RotateCw size={14} />{' '}
            {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
          </Button>
        )}
      </div>

      <div className="flex justify-center mt-4">
        {bezelFrame(<>{children}</>)}
      </div>
    </div>
  );
}
