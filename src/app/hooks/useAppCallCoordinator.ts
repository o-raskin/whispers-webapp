import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatSummary, ChatThread } from '../../shared/types/chat'
import { useCallSession } from './useCallSession'

interface UseAppCallCoordinatorArgs {
  appendEventLog: (message: string) => void
  chatsRef: MutableRefObject<ChatSummary[]>
  loadHistory: (chatId: string, currentUserId: string) => Promise<void>
  selectedChatId: string | null
  selectedChatIdRef: MutableRefObject<string | null>
  setIsHistoryLoading: Dispatch<SetStateAction<boolean>>
  setSelectedChatId: Dispatch<SetStateAction<string | null>>
  socketRef: MutableRefObject<WebSocket | null>
  threadsRef: MutableRefObject<Record<string, ChatThread>>
  userIdRef: MutableRefObject<string>
}

export function useAppCallCoordinator({
  appendEventLog,
  chatsRef,
  loadHistory,
  selectedChatId,
  selectedChatIdRef,
  setIsHistoryLoading,
  setSelectedChatId,
  socketRef,
  threadsRef,
  userIdRef,
}: UseAppCallCoordinatorArgs) {
  const {
    activeCallState,
    endActiveCall,
    startCall,
    ...restCallSession
  } = useCallSession({
    appendEventLog,
    chatsRef,
    loadHistory,
    selectedChatIdRef,
    setIsHistoryLoading,
    setSelectedChatId,
    socketRef,
    threadsRef,
    userIdRef,
  })

  const handleSelectChat = useCallback((chatId: string) => {
    if (activeCallState && activeCallState.chatId !== chatId) {
      endActiveCall({ notifyRemote: true })
    }

    setSelectedChatId(chatId)
    setIsHistoryLoading(true)
  }, [activeCallState, endActiveCall, setIsHistoryLoading, setSelectedChatId])

  const handleStartSelectedCall = useCallback((selectedThread: ChatThread | null) => {
    void startCall(selectedThread)
  }, [startCall])

  const handleEndSelectedCall = useCallback(() => {
    endActiveCall({ notifyRemote: true })
  }, [endActiveCall])

  return {
    ...restCallSession,
    activeCallState,
    handleEndSelectedCall,
    handleSelectChat,
    handleStartSelectedCall,
    selectedCallState:
      activeCallState && activeCallState.chatId === selectedChatId
        ? activeCallState
        : null,
  }
}
