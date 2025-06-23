'use client';
import { ReactNode, useEffect, useRef, useState } from 'react';

interface TooltipProps {
  placement?: 'top' | 'bottom' | 'left' | 'right';
  content: ReactNode;
  children: ReactNode;
  labelledById?: string;
  clickable?: boolean;
}

export default function Tooltip({
  content,
  children,
  clickable = false,
  placement = 'top',
  labelledById = `tooltip-${Math.random().toString(36).slice(2, 10)}`,
}: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [autoPlacement, setAutoPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>(
    placement
  );
  const [prevPlacement, setPrevPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>(
    placement
  );

  useEffect(() => {
    if (!ref.current) return;
    setPrevPlacement(autoPlacement);
    const rect = ref.current.getBoundingClientRect();
    const buffer = 20;
    if (placement === 'top' && rect.top < buffer) setAutoPlacement('bottom');
    else if (placement === 'bottom' && rect.bottom > window.innerHeight - buffer)
      setAutoPlacement('top');
    else if (placement === 'left' && rect.left < buffer) setAutoPlacement('right');
    else if (placement === 'right' && rect.right > window.innerWidth - buffer)
      setAutoPlacement('left');
  }, [placement]);

  const tooltipPosition =
    autoPlacement === 'top'
      ? 'bottom-full mb-1 -top-6'
      : autoPlacement === 'bottom'
        ? 'top-full mt-1 translate-y-1'
        : autoPlacement === 'left'
          ? 'right-full mr-1 -left-6 top-1/2 -translate-y-1/2'
          : 'left-full ml-1 -right-6 top-1/2 -translate-y-1/2';

  const arrowStyles =
    autoPlacement === 'top'
      ? 'before:-bottom-1 before:border-t-zinc-700'
      : autoPlacement === 'bottom'
        ? 'before:-top-1 before:border-b-zinc-700'
        : autoPlacement === 'left'
          ? 'before:-right-1 before:border-l-zinc-700'
          : 'before:-left-1 before:border-r-zinc-700';

  return (
    <div
      ref={ref}
      className="group relative inline-block touch-none"
      aria-describedby={labelledById}
      onTouchStart={() =>
        ref.current?.querySelector('[role=tooltip]')?.classList.add('opacity-100')
      }
    >
      <span
        role="tooltip"
        id={labelledById}
        aria-live="polite"
        aria-hidden="false"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            (e.target as HTMLElement).blur();
          }
        }}
        className={`opacity-0 group-hover:opacity-100 group-hover:translate-y-0 absolute left-1/2 -translate-x-1/2 transition-[top,left] duration-300 ease-in-out bg-zinc-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 transition-opacity transition-transform duration-300 ${clickable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'} ${tooltipPosition} before:content-[''] before:absolute before:left-1/2 before:-translate-x-1/2 before:border-4 before:border-transparent ${arrowStyles}`}
      >
        {content}
      </span>
      {children}
    </div>
  );
}
