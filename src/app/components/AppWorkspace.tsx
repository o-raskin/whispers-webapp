import { motion } from 'framer-motion'
import { ChatSidebar, type ChatSidebarProps } from '../../features/chat-list/components/ChatSidebar'
import {
  ConversationPanel,
  type ConversationPanelProps,
} from '../../features/conversation/components/ConversationPanel'
import { EventLogPanel } from '../../features/event-log/components/EventLogPanel'
import { ConnectionPanel } from '../../features/connection/components/ConnectionPanel'
import { panelTransition, shellStagger } from '../../shared/motion/presets'

interface AppWorkspaceProps {
  conversationProps: ConversationPanelProps
  eventLogLines: string[]
  isMobileChatOpen: boolean
  isMobileLayout: boolean
  selectedChatId: string | null
  sidebarProps: ChatSidebarProps
}

function WorkspaceMain({
  conversationProps,
  eventLogLines,
}: Pick<AppWorkspaceProps, 'conversationProps' | 'eventLogLines'>) {
  return (
    <motion.div className="workspace-main" variants={shellStagger}>
      <ConversationPanel {...conversationProps} />
      <EventLogPanel lines={eventLogLines} />
    </motion.div>
  )
}

export function AppWorkspace({
  conversationProps,
  eventLogLines,
  isMobileChatOpen,
  isMobileLayout,
  selectedChatId,
  sidebarProps,
}: AppWorkspaceProps) {
  return (
    <>
      <ConnectionPanel isCompactMobile={isMobileChatOpen} />

      <motion.section
        className={`workspace-grid ${selectedChatId ? 'has-mobile-chat-open' : 'is-mobile-inbox-open'}`}
        variants={shellStagger}
      >
        {isMobileLayout ? (
          <div className="mobile-workspace">
            <motion.div
              className="mobile-screen mobile-screen-inbox"
              initial={false}
              animate={{
                x: isMobileChatOpen ? '-100%' : '0%',
                opacity: 1,
                scale: 1,
              }}
              transition={panelTransition}
              style={{ pointerEvents: isMobileChatOpen ? 'none' : 'auto' }}
            >
              <ChatSidebar {...sidebarProps} />
            </motion.div>

            <motion.div
              className="mobile-screen mobile-screen-chat"
              initial={false}
              animate={{
                x: isMobileChatOpen ? '0%' : '100%',
                opacity: 1,
                scale: 1,
              }}
              transition={panelTransition}
              style={{ pointerEvents: isMobileChatOpen ? 'auto' : 'none' }}
            >
              <WorkspaceMain
                conversationProps={conversationProps}
                eventLogLines={eventLogLines}
              />
            </motion.div>
          </div>
        ) : (
          <>
            <ChatSidebar {...sidebarProps} />
            <WorkspaceMain
              conversationProps={conversationProps}
              eventLogLines={eventLogLines}
            />
          </>
        )}
      </motion.section>
    </>
  )
}
