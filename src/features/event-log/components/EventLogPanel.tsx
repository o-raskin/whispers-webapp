import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  itemReveal,
  listStagger,
  panelTransition,
  sectionReveal,
  springTransition,
} from '../../../shared/motion/presets'
import './event-log.css'

interface EventLogPanelProps {
  lines: string[]
}

export function EventLogPanel({ lines }: EventLogPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const latestLine = lines[0] ?? 'No events yet.'

  return (
    <motion.section className="log-panel" variants={sectionReveal}>
      <motion.div className="log-panel-header" variants={itemReveal}>
        <div>
          <p className="section-kicker">Diagnostics</p>
          <h2>Event log</h2>
          <p className="log-summary">{latestLine}</p>
        </div>
        <div className="log-panel-actions">
          <div className="log-indicator">Live trace</div>
          <motion.button
            className={`log-toggle ${isExpanded ? 'is-expanded' : ''}`}
            type="button"
            aria-expanded={isExpanded}
            aria-controls="diagnostics-log-feed"
            onClick={() => setIsExpanded((current) => !current)}
            whileHover={{ y: -1, scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            transition={springTransition}
          >
            {isExpanded ? 'Hide' : 'Show'}
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence initial={false}>
        {isExpanded ? (
          <motion.div
            key="diagnostics-open"
            id="diagnostics-log-feed"
            className="log-feed"
            role="log"
            aria-live="polite"
            variants={listStagger}
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={panelTransition}
          >
            <AnimatePresence mode="popLayout">
              {lines.length === 0 ? (
                <motion.div
                  className="log-empty"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  No events yet.
                </motion.div>
              ) : (
                lines.map((line, index) => (
                  <motion.div
                    key={`${line}-${index}`}
                    className={`log-line ${index === 0 ? 'latest' : ''}`}
                    variants={itemReveal}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, y: -8 }}
                    layout
                  >
                    <span className="log-bullet" aria-hidden="true" />
                    <span>{line}</span>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.section>
  )
}
