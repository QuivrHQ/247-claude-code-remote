/**
 * Animation configurations for Framer Motion
 * Provides consistent, spring-based animations throughout the app
 */

import type { Transition, Variants } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════════════════
// Spring Configurations
// ═══════════════════════════════════════════════════════════════════════════

export const spring = {
  /** Gentle spring - for subtle movements */
  gentle: {
    type: 'spring',
    stiffness: 120,
    damping: 14,
  } as const,

  /** Snappy spring - for quick interactions */
  snappy: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  } as const,
} satisfies Record<string, Transition>;

// ═══════════════════════════════════════════════════════════════════════════
// Animation Variants
// ═══════════════════════════════════════════════════════════════════════════

export const variants = {
  /** Fade in with upward movement */
  fadeInUp: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  } satisfies Variants,

  /** Collapse height animation */
  collapse: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
  } satisfies Variants,
};

// ═══════════════════════════════════════════════════════════════════════════
// Stagger Configurations
// ═══════════════════════════════════════════════════════════════════════════

export const stagger = {
  /** Fast stagger for lists */
  fast: {
    animate: {
      transition: {
        staggerChildren: 0.03,
      },
    },
  } satisfies Variants,
};

// ═══════════════════════════════════════════════════════════════════════════
// Interactive Variants (for hover/tap)
// ═══════════════════════════════════════════════════════════════════════════

export const interactive = {
  /** Subtle scale on hover/tap */
  subtle: {
    whileHover: { scale: 1.01 },
    whileTap: { scale: 0.99 },
  },
};
