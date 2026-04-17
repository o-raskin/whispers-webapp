import { motion } from 'framer-motion'
import { itemReveal, listStagger, sectionReveal, springTransition } from '../../../shared/motion/presets'
import './connection.css'

interface ConnectionPanelProps {
  isCompactMobile?: boolean
}

export function ConnectionPanel({ isCompactMobile = false }: ConnectionPanelProps) {
  return (
    <motion.section
      className={`topbar ${isCompactMobile ? 'is-compact-mobile' : ''}`}
      variants={sectionReveal}
    >
      <motion.div className="topbar-hero" variants={listStagger}>
        <div className="brand-block">
          <motion.div
            className="brand-mark"
            aria-hidden="true"
            variants={itemReveal}
            whileHover={{ scale: 1.03, rotate: -4 }}
            transition={springTransition}
          >
            <svg
              className="brand-mark-glyph"
              viewBox="0 0 64 64"
              role="presentation"
              focusable="false"
            >
              <text
                x="50%"
                y="54%"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                W
              </text>
            </svg>
          </motion.div>
          <motion.div className="brand-copy" variants={itemReveal}>
            <p className={`eyebrow ${isCompactMobile ? 'is-hidden' : ''}`}>
              Premium realtime messaging
            </p>
            <h1>Whispers</h1>
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  )
}
