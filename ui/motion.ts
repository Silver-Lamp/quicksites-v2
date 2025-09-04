// ui/motion.ts
// ===============================
// Reusable Framer Motion variants & transitions using uiTokens
// ===============================

import type { Variants, Transition } from "framer-motion";
import { durations, easing, springs } from "./uiTokens";


export const transitions = {
hover: { duration: durations.hover, ease: easing.standard } as Transition,
pop: { duration: durations.pop, ease: easing.standard } as Transition,
panelIn: { duration: durations.panel, ease: easing.decel } as Transition,
panelOut: { duration: 0.2, ease: easing.accel } as Transition,
overlay: { duration: durations.overlay, ease: easing.standard } as Transition,
};

// Inline micro-toolbar (✎ / ✨ / ⋯ / ⚙)
export const microToolbar: Variants = {
initial: { opacity: 0, y: 6 },
animate: { opacity: 1, y: 0, transition: transitions.hover },
exit: { opacity: 0, y: 4, transition: { duration: 0.12, ease: easing.accel } },
};


// Sparkle badge for AI Brush
export const sparkleBadge: Variants = {
initial: { scale: 0.96, opacity: 0 },
animate: { scale: 1, opacity: 1, transition: springs.pop },
};


// Inspector drawer (right sheet)
export const inspectorDrawer: Variants = {
initial: { x: 24, opacity: 0 },
animate: { x: 0, opacity: 1, transition: transitions.panelIn },
exit: { x: 24, opacity: 0, transition: transitions.panelOut },
};


// Command palette modal
export const commandPalette: Variants = {
scrimInitial: { opacity: 0 },
scrimAnimate: { opacity: 1, transition: transitions.overlay },
panelInitial: { scale: 0.98, opacity: 0 },
panelAnimate: { scale: 1, opacity: 1, transition: springs.pop },
};


// Mobile bottom sheet
export const bottomSheet: Variants = {
initial: { y: 24, opacity: 0 },
animate: { y: 0, opacity: 1, transition: springs.sheet },
exit: { y: 24, opacity: 0, transition: { duration: 0.2, ease: easing.accel } },
};


// Variants board cards (stagger handled at parent level)
export const variantCard: Variants = {
initial: { opacity: 0, y: 10 },
animate: { opacity: 1, y: 0, transition: { duration: durations.variant, ease: easing.standard } },
};


// Simple helpers
export const fx = {
fadeIn: (d = durations.pop): Transition => ({ duration: d, ease: easing.standard }),
popIn: springs.pop,
};


/**
* Example usage:
*
* import { motion } from 'framer-motion'
* import { microToolbar, inspectorDrawer } from '@/ui/motion'
*
* <motion.div variants={microToolbar} initial="initial" animate="animate" exit="exit"> ... </motion.div>
*
* <AnimatePresence>
* {open && (
* <motion.aside variants={inspectorDrawer} initial="initial" animate="animate" exit="exit" />
* )}
* </AnimatePresence>
*/