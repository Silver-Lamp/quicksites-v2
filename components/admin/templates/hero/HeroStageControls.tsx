'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { microToolbar } from '@/ui/motion';
import { Grid3X3, Crosshair, Eye, EyeOff, Wand2 } from 'lucide-react';

export type OverlayLevel = 'none' | 'soft' | 'strong';

export type HeroStageControlsProps = {
  imageUrl?: string;
  imagePosition: { x: number; y: number };
  overlay: OverlayLevel;
  showGrid?: boolean;
  onChange: (next: Partial<{ imagePosition: { x: number; y: number }; overlay: OverlayLevel; showGrid: boolean }>) => void;
  className?: string;
  children?: React.ReactNode;
  isDark?: boolean;
};

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v));

function overlayAlpha(level: OverlayLevel) { if (level==='none') return 0; if (level==='strong') return 0.6; return 0.35; }
function contrastRatioForOverlay(level: OverlayLevel, isDark: boolean) {
  const a = overlayAlpha(level);
  if (isDark) { const Lbg = 1 - a; const Ltext = 1; return (Ltext+0.05)/(Lbg+0.05); }
  const Lbg = a, Ltext = 0; return (Lbg+0.05)/(Ltext+0.05);
}
function nextOverlay(level: OverlayLevel, dir: 1 | -1): OverlayLevel {
  const order: OverlayLevel[] = ['none','soft','strong']; const i = Math.max(0, Math.min(order.length-1, order.indexOf(level)+dir)); return order[i];
}
const emit = (name: string, detail?: any) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {} };

/** Brutal stop: blocks React + any native listeners (including capture on document). */
function swallow(e: any) {
  if (e?.preventDefault) e.preventDefault();
  if (e?.stopPropagation) e.stopPropagation();
  if (e?.nativeEvent?.stopImmediatePropagation) e.nativeEvent.stopImmediatePropagation();
}

export default function HeroStageControls({
  imageUrl,
  imagePosition,
  overlay,
  showGrid = false,
  onChange,
  className,
  children,
  isDark: isDarkProp,
}: HeroStageControlsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const topLeftRef = useRef<HTMLDivElement>(null);
  const bottomLeftRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    if (typeof isDarkProp === 'boolean') setIsDark(isDarkProp);
    else if (typeof document !== 'undefined') setIsDark(document.documentElement.classList.contains('dark'));
  }, [isDarkProp]);

  const overlayColor = overlay === 'strong' ? 'rgba(0,0,0,0.45)' : overlay === 'soft' ? 'rgba(0,0,0,0.25)' : 'transparent';
  const overlayColorLight = overlay === 'strong' ? 'rgba(255,255,255,0.60)' : overlay === 'soft' ? 'rgba(255,255,255,0.35)' : 'transparent';

  const updateFromEvent = (e: React.PointerEvent) => {
    const el = wrapRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp(((e.clientX - rect.left) / rect.width) * 100);
    const y = clamp(((e.clientY - rect.top) / rect.height) * 100);
    onChange({ imagePosition: { x, y } });
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    updateFromEvent(e);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => { if (dragging) updateFromEvent(e); }, [dragging]);
  const onPointerUp   = useCallback((e: React.PointerEvent) => { try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} setDragging(false); }, []);

  const onKeyAdjust = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    let { x, y } = imagePosition;
    if (e.key === 'ArrowLeft')  x = clamp(x - step);
    if (e.key === 'ArrowRight') x = clamp(x + step);
    if (e.key === 'ArrowUp')    y = clamp(y - step);
    if (e.key === 'ArrowDown')  y = clamp(y + step);
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) { swallow(e); onChange({ imagePosition: { x, y } }); }
  };

  // Root capture guard — swallows events originating in any controls zone
  const rootCapture = (e: React.SyntheticEvent) => {
    const t = e.target as HTMLElement;
    if (
      controlsRef.current?.contains(t) ||
      topLeftRef.current?.contains(t) ||
      bottomLeftRef.current?.contains(t)
    ) swallow(e);
  };

  const ratio = useMemo(() => contrastRatioForOverlay(overlay, isDark), [overlay, isDark]);
  const status = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA Large' : 'Low';
  const ratioStr = `${ratio.toFixed(1)}:1`;
  const statusColor =
    status === 'AAA' ? 'bg-emerald-500 text-white' :
    status === 'AA' ? 'bg-emerald-400 text-black' :
    status === 'AA Large' ? 'bg-amber-400 text-black' :
    'bg-rose-500 text-white';
  const suggestDir: 1 | -1 | 0 = ratio < 4.5 && overlay !== 'strong' ? 1 : ratio >= 7 && overlay === 'strong' ? -1 : 0;

  return (
    <div
      ref={wrapRef}
      className={`relative rounded-3xl overflow-hidden border ${className || ''}`}
      style={{
        backgroundImage: imageUrl ? `url(${imageUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: `${imagePosition.x}% ${imagePosition.y}%`,
      }}
      onClickCapture={rootCapture}
      onPointerDownCapture={rootCapture}
      onPointerUpCapture={rootCapture}
      onMouseDownCapture={rootCapture}
      onMouseUpCapture={rootCapture}
      onTouchStartCapture={rootCapture as any}
      onTouchEndCapture={rootCapture as any}
    >
      {/* Overlay tint */}
      <div className="absolute inset-0" style={{ backgroundColor: isDark ? overlayColor : overlayColorLight }} aria-hidden />

      {/* Optional grid */}
      {showGrid && (
        <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" aria-hidden>
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" className="text-white" />
          <line x1="33.33%" x2="33.33%" y1="0" y2="100%" stroke="white" strokeOpacity="0.25" />
          <line x1="66.66%" x2="66.66%" y1="0" y2="100%" stroke="white" strokeOpacity="0.25" />
          <line y1="33.33%" y2="33.33%" x1="0" x2="100%" stroke="white" strokeOpacity="0.25" />
          <line y1="66.66%" y2="66.66%" x1="0" x2="100%" stroke="white" strokeOpacity="0.25" />
        </svg>
      )}

      {/* Content */}
      <div className="relative z-[11]">{children}</div>

      {/* Focal knob — swallow on all phases */}
      <button
        type="button"
        aria-label={`Focal point at ${Math.round(imagePosition.x)}% / ${Math.round(imagePosition.y)}%`}
        title="Drag to adjust focal point (arrow keys to nudge; hold Shift for 5%)"
        onPointerDown={(e) => { swallow(e); onPointerDown(e); }}
        onPointerMove={(e) => { swallow(e); onPointerMove(e); }}
        onPointerUp={(e)   => { swallow(e); onPointerUp(e); }}
        onKeyDown={(e)     => { swallow(e); onKeyAdjust(e); }}
        onClick={swallow}
        onMouseDown={swallow}
        onMouseUp={swallow}
        onContextMenu={swallow}
        className="absolute z-[12] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70 bg-white/30 backdrop-blur w-5 h-5 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-white/70"
        style={{ left: `${imagePosition.x}%`, top: `${imagePosition.y}%` }}
      >
        <Crosshair className="w-3.5 h-3.5 text-white/90" />
      </button>

      {/* Controls panel (top-right) */}
      <div
        ref={controlsRef}
        className="absolute right-3 top-3 z-[13] text-xs text-white/90"
        onClickCapture={swallow}
        onPointerDownCapture={swallow}
        onPointerUpCapture={swallow}
        onMouseDownCapture={swallow}
        onMouseUpCapture={swallow}
      >
        <div className="inline-flex items-center gap-2 rounded-xl bg-black/45 backdrop-blur px-2 py-1 border border-white/20">
          <span className="hidden md:inline">Overlay</span>
          {(['none','soft','strong'] as OverlayLevel[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              data-hero-overlay={lvl}
              onClick={(e) => { swallow(e); onChange({ overlay: lvl }); emit('qs:hero:set', { overlay_level: lvl }); }}
              onMouseDown={swallow}
              onMouseUp={swallow}
              onPointerDown={swallow}
              onPointerUp={swallow}
              className={`px-2 py-0.5 rounded-md border ${overlay === lvl ? 'bg-white text-gray-900 border-white' : 'bg-white/10 text-white border-white/20'}`}
            >
              {lvl}
            </button>
          ))}
          <span className="w-px h-4 bg-white/20" />
          <button
            type="button"
            onClick={(e) => { swallow(e); const next = !showGrid; onChange({ showGrid: next }); emit('qs:hero:set', { showGrid: next }); }}
            onMouseDown={swallow}
            onMouseUp={swallow}
            onPointerDown={swallow}
            onPointerUp={swallow}
            className={`px-2 py-0.5 rounded-md border ${showGrid ? 'bg-white text-gray-900 border-white' : 'bg-white/10 text-white border-white/20'}`}
            title="Toggle grid"
          >
            {showGrid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <Grid3X3 className="w-4 h-4 opacity-70" />
        </div>
      </div>

      {/* Contrast badge + Auto-fix (top-left) */}
      <motion.div
        ref={topLeftRef}
        className="absolute left-3 top-3 z-[13] flex items-center gap-2"
        variants={microToolbar}
        initial="initial"
        animate="animate"
        onClickCapture={swallow}
        onPointerDownCapture={swallow}
        onPointerUpCapture={swallow}
        onMouseDownCapture={swallow}
        onMouseUpCapture={swallow}
      >
        <div
          className={`px-2 py-1 rounded-md text-[11px] border border-white/15 backdrop-blur ${statusColor}`}
          title="Estimated worst-case contrast (WCAG 2.1)"
        >
          Contrast {ratioStr} — {status}
        </div>
        {suggestDir !== 0 && (
          <button
            type="button"
            data-hero-action="auto-fix-contrast"
            onClick={(e) => {
              swallow(e);
              const next = nextOverlay(overlay, suggestDir);
              onChange({ overlay: next });
              emit('qs:hero:auto-fix');
              emit('qs:hero:set', { overlay_level: next });
            }}
            onMouseDown={swallow}
            onMouseUp={swallow}
            onPointerDown={swallow}
            onPointerUp={swallow}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-white/10 text-white border border-white/20 hover:bg-white/20"
            title={suggestDir > 0 ? 'Increase overlay for better readability' : 'Soften overlay'}
          >
            <Wand2 className="w-3.5 h-3.5" /> {suggestDir > 0 ? 'Auto-fix' : 'Soften'}
          </button>
        )}
      </motion.div>

      {/* Readout chip (bottom-left) */}
      <motion.div
        ref={bottomLeftRef}
        className="absolute left-3 bottom-3 z-[13] text-[11px] text-white/80 bg-black/40 px-2 py-1 rounded-md border border-white/20"
        variants={microToolbar}
        initial="initial"
        animate="animate"
        onClickCapture={swallow}
        onPointerDownCapture={swallow}
        onPointerUpCapture={swallow}
        onMouseDownCapture={swallow}
        onMouseUpCapture={swallow}
      >
        Focal: {Math.round(imagePosition.x)}% / {Math.round(imagePosition.y)}%
      </motion.div>
    </div>
  );
}
