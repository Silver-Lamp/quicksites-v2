// components/home/reseller-diagram.tsx
//
// Brand-matched "1 platform → many resellers → end users" diagram for the
// homepage reseller section. Hand-built inline SVG (scales as one unit, no
// dependency, no bundle weight) rather than a client mermaid render, so it
// stays crisp and on-brand in the zinc/sky palette.
//
// Equivalent mermaid source (kept for reference / future edits):
//   graph TD
//     QS["QuickSites — platform + commerce engine"]
//     QS --> CS["CedarSites — a live reseller (own brand & domain)"]
//     QS --> YB["Your brand here — resell under your own brand"]
//     QS -.-> MORE["+ more resellers"]
//     CS --> CU["Merchants & their customers"]
//     YB --> YU["Merchants & their customers"]
//     EX["Your existing client sites"] -. migrate in .-> CS
//
// The 1→many fan-out is the point: one engine (us), many white-labeled
// resellers (CedarSites is the live example), each serving their own merchants.

const SKY = '#38bdf8';

export default function ResellerDiagram() {
  return (
    <div className="overflow-x-auto">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 940 520"
        className="mx-auto h-auto w-full min-w-[640px] max-w-3xl"
        role="img"
        aria-labelledby="reseller-diagram-title reseller-diagram-desc"
      >
        <title id="reseller-diagram-title">How reselling QuickSites works</title>
        <desc id="reseller-diagram-desc">
          QuickSites is the platform. Many resellers — including CedarSites, a live example, plus your
          own brand — build on it and serve their own merchants and end users. Resellers can migrate
          their existing client sites in.
        </desc>

        <defs>
          <marker id="rd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={SKY} />
          </marker>
          <clipPath id="rd-cs-logo">
            <rect x="150" y="230" width="44" height="44" rx="10" />
          </clipPath>
        </defs>

        {/* ── connectors (drawn first, under the nodes) ── */}
        <g fill="none" stroke={SKY} strokeWidth="2">
          {/* QuickSites → resellers */}
          <path d="M 430 132 C 380 170, 300 172, 250 202" markerEnd="url(#rd-arrow)" />
          <path d="M 510 132 C 560 170, 640 172, 690 202" markerEnd="url(#rd-arrow)" />
          {/* resellers → end users */}
          <path d="M 250 300 L 250 380" markerEnd="url(#rd-arrow)" />
          <path d="M 690 300 L 690 380" markerEnd="url(#rd-arrow)" />
        </g>
        {/* QuickSites → "+ more" (implies 1→many) */}
        <path d="M 520 120 C 660 130, 800 150, 852 196" fill="none" stroke="#52525b" strokeWidth="2" strokeDasharray="5 5" markerEnd="url(#rd-arrow)" />
        {/* migrate existing sites in → CedarSites */}
        <path d="M 120 462 C 160 430, 190 380, 214 306" fill="none" stroke={SKY} strokeWidth="2" strokeDasharray="6 5" strokeOpacity="0.8" markerEnd="url(#rd-arrow)" />

        {/* ── QuickSites (platform) ── */}
        <g>
          <rect x="360" y="44" width="220" height="88" rx="16" fill="#082433" stroke="#0ea5e9" strokeWidth="2" />
          <text x="470" y="82" textAnchor="middle" fill="#f4f4f5" fontSize="26" fontWeight="700" fontFamily="sans-serif">QuickSites</text>
          <text x="470" y="108" textAnchor="middle" fill="#7dd3fc" fontSize="14" fontFamily="sans-serif">the platform + commerce engine</text>
        </g>

        {/* ── CedarSites (live reseller) — real logo tile + brand lockup ── */}
        <g>
          <rect x="130" y="204" width="240" height="96" rx="14" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
          {/* brand tile (cream pinecone on cedar green) */}
          <rect x="150" y="230" width="44" height="44" rx="10" fill="#123524" />
          <image
            href="/logo_cedarsites_v2_96.png"
            x="150"
            y="230"
            width="44"
            height="44"
            clipPath="url(#rd-cs-logo)"
            preserveAspectRatio="xMidYMid slice"
          />
          {/* LIVE pill, top-right */}
          <rect x="300" y="216" width="54" height="20" rx="10" fill="#0ea5e9" />
          <text x="327" y="230" textAnchor="middle" fill="#0a0a0a" fontSize="11" fontWeight="700" fontFamily="sans-serif">LIVE</text>
          {/* name + tagline, left-anchored beside the tile */}
          <text x="206" y="254" textAnchor="start" fill="#f4f4f5" fontSize="22" fontWeight="700" fontFamily="sans-serif">CedarSites</text>
          <text x="206" y="276" textAnchor="start" fill="#a1a1aa" fontSize="12.5" fontFamily="sans-serif">reseller · own brand &amp; domain</text>
        </g>

        {/* ── Your brand here (placeholder reseller) ── */}
        <g>
          <rect x="570" y="204" width="240" height="96" rx="14" fill="#0a0a0a" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="7 5" strokeOpacity="0.7" />
          <text x="690" y="264" textAnchor="middle" fill="#e4e4e7" fontSize="23" fontWeight="700" fontFamily="sans-serif">Your brand here</text>
          <text x="690" y="286" textAnchor="middle" fill="#71717a" fontSize="13" fontFamily="sans-serif">resell under your own brand</text>
        </g>

        {/* ── "+ more resellers" ghost ── */}
        <g>
          <rect x="828" y="230" width="96" height="52" rx="12" fill="none" stroke="#52525b" strokeWidth="1.5" strokeDasharray="5 5" />
          <text x="876" y="253" textAnchor="middle" fill="#71717a" fontSize="12" fontWeight="600" fontFamily="sans-serif">+ more</text>
          <text x="876" y="270" textAnchor="middle" fill="#71717a" fontSize="12" fontWeight="600" fontFamily="sans-serif">resellers</text>
        </g>

        {/* ── end users under each reseller ── */}
        <g>
          <rect x="130" y="382" width="240" height="80" rx="14" fill="#111113" stroke="#27272a" strokeWidth="2" />
          <text x="250" y="416" textAnchor="middle" fill="#d4d4d8" fontSize="16" fontWeight="600" fontFamily="sans-serif">Merchants &amp; customers</text>
          <text x="250" y="437" textAnchor="middle" fill="#71717a" fontSize="12.5" fontFamily="sans-serif">sites · stores · checkout</text>
        </g>
        <g>
          <rect x="570" y="382" width="240" height="80" rx="14" fill="#111113" stroke="#27272a" strokeWidth="2" />
          <text x="690" y="416" textAnchor="middle" fill="#d4d4d8" fontSize="16" fontWeight="600" fontFamily="sans-serif">Merchants &amp; customers</text>
          <text x="690" y="437" textAnchor="middle" fill="#71717a" fontSize="12.5" fontFamily="sans-serif">sites · stores · checkout</text>
        </g>

        {/* ── migration label ── */}
        <text x="70" y="452" textAnchor="middle" fill={SKY} fontSize="12.5" fontWeight="600" fontFamily="sans-serif">migrate</text>
        <text x="70" y="470" textAnchor="middle" fill={SKY} fontSize="12.5" fontWeight="600" fontFamily="sans-serif">sites in</text>
      </svg>
    </div>
  );
}
