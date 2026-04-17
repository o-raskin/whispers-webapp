import { AnimatePresence, motion } from 'framer-motion'
import type { CallPhase } from '../../../shared/types/chat'
import { panelTransition, springTransition } from '../../../shared/motion/presets'
import './conversation-call-banner.css'

interface ConversationCallBannerProps {
  callParticipantLabel: string
  callPhase: CallPhase
  onAcceptCall: () => void
  onDeclineCall: () => void
  onEndCall: () => void
}

export function ConversationCallBanner({
  callParticipantLabel,
  callPhase,
  onAcceptCall,
  onDeclineCall,
  onEndCall,
}: ConversationCallBannerProps) {
  return (
    <AnimatePresence initial={false}>
      {callPhase !== 'idle' ? (
        <motion.div
          key={`call-banner-${callPhase}`}
          className="conversation-call-banner"
          initial={{ opacity: 0, y: -10, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
          transition={panelTransition}
        >
          <div className="conversation-call-copy">
            <div className="conversation-call-eyebrow">Audio call</div>
            <div className="conversation-call-title">
              {callPhase === 'incoming'
                ? `${callParticipantLabel} is calling`
                : callPhase === 'outgoing'
                  ? `Calling ${callParticipantLabel}...`
                  : callPhase === 'connecting'
                    ? `Connecting with ${callParticipantLabel}...`
                    : 'Call in progress'}
            </div>
          </div>
          <div className="conversation-call-actions">
            {callPhase === 'incoming' ? (
              <>
                <motion.button
                  className="conversation-call-action"
                  type="button"
                  onClick={onAcceptCall}
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={springTransition}
                >
                  Accept
                </motion.button>
                <motion.button
                  className="conversation-call-action secondary"
                  type="button"
                  onClick={onDeclineCall}
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  transition={springTransition}
                >
                  Decline
                </motion.button>
              </>
            ) : (
              <motion.button
                className="conversation-call-action secondary"
                type="button"
                onClick={onEndCall}
                whileHover={{ y: -1, scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                transition={springTransition}
              >
                {callPhase === 'outgoing' ? 'Cancel' : 'Hang up'}
              </motion.button>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
