// ==============================
// File: components/admin/templates/hero/README-usage.md
// ==============================

/**
 * Usage (sketch):
 *
 * import HeroStageControls, { type OverlayLevel } from './HeroStageControls';
 * import HeroCommandPalette, { makeHeroActions } from './HeroCommandPalette';
 *
 * function HeroPreviewStage({ block, template, onUpdate }) {
 *   const [pos, setPos] = useState<{x:number;y:number}>({ x: 65, y: 50 });
 *   const [overlay, setOverlay] = useState<OverlayLevel>('soft');
 *   const [grid, setGrid] = useState(false);
 *
 *   // Optionally listen to palette events to update local state
 *   useEffect(() => {
 *     const onOverlay = (e: any) => setOverlay((prev) => {
 *       const step = Math.max(-1, Math.min(1, Number(e.detail?.step)||0));
 *       const order: OverlayLevel[] = ['none','soft','strong'];
 *       const idx = Math.max(0, Math.min(2, order.indexOf(prev) + step));
 *       return order[idx];
 *     });
 *     window.addEventListener('qs:hero:set-overlay', onOverlay as any);
 *     return () => window.removeEventListener('qs:hero:set-overlay', onOverlay as any);
 *   }, []);
 *
 *   return (
 *     <>
 *       <HeroCommandPalette actions={makeHeroActions()} />
 *       <HeroStageControls
 *         imageUrl={block?.content?.image_url || block?.props?.heroImage}
 *         imagePosition={pos}
 *         overlay={overlay}
 *         showGrid={grid}
 *         onChange={(next) => {
 *           if (next.imagePosition) setPos(next.imagePosition);
 *           if (next.overlay) setOverlay(next.overlay);
 *           if (typeof next.showGrid === 'boolean') setGrid(next.showGrid);
 *           // You can also mirror into editor state via onUpdate
 *         }}
 *         className="border-white/10 bg-[#0e0f14]"
 *       >
 *         {/* your headline/subhead/cta render here */}
 *         <div className="px-10 py-24 text-center">
 *           <h1 className="text-5xl font-extrabold">Crafts Made Easy</h1>
 *           <p className="mt-3 text-white/85 max-w-2xl mx-auto">Quick and reliable crafting services…</p>
 *           <button className="mt-6 px-5 py-3 rounded-full bg-white text-gray-900 font-semibold">Get Started Today</button>
 *         </div>
 *       </HeroStageControls>
 *     </>
 *   );
 * }
 */
