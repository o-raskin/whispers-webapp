import type { Transition, Variants } from 'framer-motion'

export const easeOutQuint = [0.22, 1, 0.36, 1] as const
export const easeOutSoft = [0.16, 1, 0.3, 1] as const

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 24,
  mass: 0.8,
}

export const panelTransition: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 24,
  mass: 0.9,
}

export const luxuriousSpring: Transition = {
  type: 'spring',
  stiffness: 150,
  damping: 22,
  mass: 1.02,
}

export const shellStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
}

export const sectionReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
    filter: 'blur(18px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.64,
      ease: easeOutQuint,
    },
  },
}

export const listStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.04,
    },
  },
}

export const itemReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 16,
    filter: 'blur(8px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.42,
      ease: easeOutSoft,
    },
  },
}

export const gentleMaskReveal: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
    scale: 0.985,
    filter: 'blur(20px)',
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.72,
      ease: easeOutQuint,
    },
  },
}
