// components/for-rep/pitch-art.tsx
//
// The small looping visual beside each pitch on /for-sales (owner, 2026-10-11: "add lottie-like
// visuals to each"). Pure inline SVG + CSS keyframes: no animation library, no JSON bundle, no
// client JS — it server-renders and animates on first paint, and `prefers-reduced-motion` freezes
// it on the resting frame. Colours come from the page's own palette (emerald / sky / zinc), never
// a brand mark, and nothing in either picture is a claim: a phone tapping a menu, a site gaining
// an ordering card.
//
//   lunch    — a phone showing a three-row menu; a fingertip taps the middle row, a check pops.
//   business — a browser window (their site, unchanged) and an ordering card that slides in
//              beside it, joined by an arrow; a dot on the card pulses "live".

export type PitchArtKind = 'lunch' | 'business';

const CSS = `
@keyframes qs-pa-tap { 0%,55%,100% { transform: translate(0,0) scale(1); opacity:.0 } 60% { opacity:1; transform: translate(0,0) scale(1) } 68% { transform: translate(0,2px) scale(.92) } 78% { opacity:1 } 90% { opacity:0 } }
@keyframes qs-pa-row { 0%,60% { fill: rgba(161,161,170,.18) } 70%,88% { fill: rgba(16,185,129,.45) } 100% { fill: rgba(161,161,170,.18) } }
@keyframes qs-pa-check { 0%,72% { transform: scale(0); opacity:0 } 80% { transform: scale(1.15); opacity:1 } 86%,96% { transform: scale(1); opacity:1 } 100% { transform: scale(0); opacity:0 } }
@keyframes qs-pa-slide { 0%,10% { transform: translateX(26px); opacity:0 } 30%,85% { transform: translateX(0); opacity:1 } 100% { transform: translateX(26px); opacity:0 } }
@keyframes qs-pa-arrow { 0%,20% { opacity:0 } 40%,85% { opacity:1 } 100% { opacity:0 } }
@keyframes qs-pa-pulse { 0%,100% { r:2.2; opacity:.9 } 50% { r:3.6; opacity:.35 } }
.qs-pa-tap { animation: qs-pa-tap 4s ease-in-out infinite; transform-origin: 50px 44px; }
.qs-pa-row2 { animation: qs-pa-row 4s ease-in-out infinite; }
.qs-pa-check { animation: qs-pa-check 4s ease-in-out infinite; transform-origin: 66px 44px; transform-box: fill-box; }
.qs-pa-card { animation: qs-pa-slide 5s ease-in-out infinite; }
.qs-pa-arrow { animation: qs-pa-arrow 5s ease-in-out infinite; }
.qs-pa-pulse { animation: qs-pa-pulse 1.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .qs-pa-tap, .qs-pa-row2, .qs-pa-check, .qs-pa-card, .qs-pa-arrow, .qs-pa-pulse { animation: none; }
  .qs-pa-tap { opacity: 0 } .qs-pa-check { opacity: 1; transform: none } .qs-pa-card { opacity: 1; transform: none } .qs-pa-arrow { opacity: 1 }
}
`;

function Lunch() {
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden className="shrink-0">
      {/* phone */}
      <rect x="22" y="8" width="52" height="80" rx="9" fill="rgba(24,24,27,1)" stroke="rgba(161,161,170,.55)" strokeWidth="2" />
      <rect x="40" y="13" width="16" height="3" rx="1.5" fill="rgba(161,161,170,.45)" />
      {/* menu rows */}
      <rect x="29" y="24" width="38" height="11" rx="3" fill="rgba(161,161,170,.18)" />
      <rect x="29" y="39" width="38" height="11" rx="3" className="qs-pa-row2" />
      <rect x="29" y="54" width="38" height="11" rx="3" fill="rgba(161,161,170,.18)" />
      {/* prices */}
      <rect x="56" y="28" width="8" height="3" rx="1.5" fill="rgba(161,161,170,.5)" />
      <rect x="56" y="43" width="8" height="3" rx="1.5" fill="rgba(161,161,170,.5)" />
      <rect x="56" y="58" width="8" height="3" rx="1.5" fill="rgba(161,161,170,.5)" />
      {/* order bar */}
      <rect x="29" y="72" width="38" height="9" rx="4.5" fill="rgba(16,185,129,.9)" />
      {/* fingertip */}
      <circle cx="50" cy="44" r="6" fill="rgba(56,189,248,.9)" className="qs-pa-tap" />
      {/* check */}
      <g className="qs-pa-check">
        <circle cx="66" cy="44" r="7" fill="rgba(16,185,129,1)" />
        <path d="M62.5 44.2 l2.4 2.4 l4.6 -5" fill="none" stroke="#0a0a0a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function Business() {
  return (
    <svg viewBox="0 0 96 96" width="96" height="96" aria-hidden className="shrink-0">
      {/* their site, a browser window — unchanged */}
      <rect x="6" y="20" width="46" height="56" rx="6" fill="rgba(24,24,27,1)" stroke="rgba(161,161,170,.55)" strokeWidth="2" />
      <rect x="6" y="20" width="46" height="10" rx="6" fill="rgba(161,161,170,.18)" />
      <circle cx="12" cy="25" r="1.6" fill="rgba(161,161,170,.6)" />
      <circle cx="17" cy="25" r="1.6" fill="rgba(161,161,170,.6)" />
      <rect x="12" y="36" width="34" height="14" rx="3" fill="rgba(56,189,248,.25)" />
      <rect x="12" y="55" width="26" height="3" rx="1.5" fill="rgba(161,161,170,.45)" />
      <rect x="12" y="62" width="30" height="3" rx="1.5" fill="rgba(161,161,170,.3)" />
      <rect x="12" y="69" width="20" height="3" rx="1.5" fill="rgba(161,161,170,.3)" />
      {/* arrow */}
      <path d="M54 48 h8" stroke="rgba(16,185,129,.9)" strokeWidth="2" strokeLinecap="round" className="qs-pa-arrow" />
      <path d="M59.5 44.5 l3.5 3.5 l-3.5 3.5" fill="none" stroke="rgba(16,185,129,.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="qs-pa-arrow" />
      {/* the ordering card, sliding in */}
      <g className="qs-pa-card">
        <rect x="64" y="30" width="28" height="38" rx="5" fill="rgba(6,78,59,.55)" stroke="rgba(16,185,129,.8)" strokeWidth="2" />
        <rect x="69" y="37" width="18" height="3" rx="1.5" fill="rgba(167,243,208,.8)" />
        <rect x="69" y="44" width="14" height="3" rx="1.5" fill="rgba(167,243,208,.5)" />
        <rect x="69" y="51" width="16" height="3" rx="1.5" fill="rgba(167,243,208,.5)" />
        <rect x="69" y="59" width="18" height="5" rx="2.5" fill="rgba(16,185,129,.95)" />
        <circle cx="87" cy="34" r="2.2" fill="rgba(74,222,128,1)" className="qs-pa-pulse" />
      </g>
    </svg>
  );
}

export default function PitchArt({ kind }: { kind: PitchArtKind }) {
  return (
    <span className="relative -my-2 inline-flex items-center">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {kind === 'lunch' ? <Lunch /> : <Business />}
    </span>
  );
}
