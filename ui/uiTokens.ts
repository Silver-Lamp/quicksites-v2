// ===============================
// File: uiTokens.ts
// Centralized design & motion tokens for QuickSites editor UI
// ===============================


export type ThemeMode = "dark" | "light";


// Durations are in SECONDS for Framer Motion compatibility
export const durations = {
hover: 0.14,
tap: 0.08,
pop: 0.18,
panel: 0.26,
overlay: 0.22,
variant: 0.3,
} as const;


// Easing curves for Framer Motion (cubic-bezier)
export const easing = {
standard: [0.2, 0, 0, 1] as [number, number, number, number],
decel: [0, 0, 0, 1] as [number, number, number, number], // enter
accel: [0.3, 0, 1, 1] as [number, number, number, number], // exit
};


// Common springs
export const springs = {
pop: { type: "spring" as const, mass: 0.3, stiffness: 220, damping: 26 },
sheet: { type: "spring" as const, mass: 0.5, stiffness: 210, damping: 28 },
};


export const zIndex = {
stage: 10,
variants: 20,
inspector: 40,
topbar: 50,
popover: 60,
modal: 70,
sheet: 80,
palette: 90,
toast: 100,
} as const;


export const radius = {
sm: 10,
md: 16,
lg: 24,
xxl: 32,
} as const;


export const shadow = {
elev1: "0 1px 2px rgba(0,0,0,.24)",
elev2: "0 6px 16px rgba(0,0,0,.24), 0 2px 4px rgba(0,0,0,.16)",
elev3: "0 12px 28px rgba(0,0,0,.28), 0 6px 12px rgba(0,0,0,.20)",
} as const;


// CSS variable maps for runtime theming (optional)
const darkVars: Record<string, string> = {
"--bg-canvas": "#0c0d10",
"--bg-elev-1": "rgba(255,255,255,0.05)",
"--bg-elev-2": "rgba(255,255,255,0.08)",
}