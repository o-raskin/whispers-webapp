import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { ChatSidebar } from '../features/chat-list/components/ChatSidebar'
import { ConnectionPanel } from '../features/connection/components/ConnectionPanel'
import { ConversationPanel } from '../features/conversation/components/ConversationPanel'
import { EventLogPanel } from '../features/event-log/components/EventLogPanel'
import { WelcomeExperience } from '../features/welcome/components/WelcomeExperience'
import { toChatMessage, toMessageId } from '../shared/adapters/chatAdapters'
import {
  buildWebSocketUrl,
  createChat,
  fetchChats,
  fetchMessages,
  fetchUsers,
  sendWebSocketCommand,
} from '../shared/api/chatApi'
import {
  DEFAULT_WS_URL,
  DEFAULT_WEBRTC_ICE_SERVERS,
  PRESENCE_PING_INTERVAL_MS,
} from '../shared/config/backend'
import type {
  ActiveCallState,
  CallSignalPayload,
  ChatSummary,
  ChatThread,
  ChatMessage,
  ConnectionStatus,
  MessageRecord,
  PingCommand,
  SendMessageCommand,
  TypingCommand,
  UserPresence,
  WebSocketIncomingEvent,
} from '../shared/types/chat'
import { panelTransition, shellStagger } from '../shared/motion/presets'
import {
  buildCallSignalText,
  isCallSignalText,
  parseCallSignalText,
} from '../shared/utils/callSignals'
import {
  appendLog,
  countUnreadMessages,
  hasTypedEventShape,
  isMessageRecord,
  isPresenceEvent,
  isTypingEvent,
  loadReadMarkers,
  saveReadMarkers,
} from './appTestUtils'

const TYPING_REFRESH_INTERVAL_MS = 4000
const MOBILE_LAYOUT_MEDIA_QUERY = '(max-width: 760px)'

function filterVisibleMessages(messages: MessageRecord[]) {
  return messages.filter((message) => !isCallSignalText(message.text))
}

function createCallId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `call-${Date.now()}`
}

function getAudioInputAvailabilityError() {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Audio calling requires HTTPS or localhost. Open the app over a secure origin and try again.'
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return 'Audio calling is unavailable because this page does not have access to media devices.'
  }

  if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
    return 'Audio calling is not supported in this browser.'
  }

  return null
}

function toAudioStreamErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) {
    return null
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow microphone access and try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone was found on this device.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your microphone is busy or unavailable right now.'
    case 'OverconstrainedError':
      return 'No compatible microphone input is available.'
    default:
      return null
  }
}

interface PeerConnectionSession {
  callId: string
  chatId: string
  participant: string
  peerConnectionId: number
}

function buildCleanupStackTrace() {
  try {
    throw new Error('WebRTC cleanup trace')
  } catch (error) {
    return error instanceof Error ? error.stack ?? 'stack unavailable' : 'stack unavailable'
  }
}

export function App() {
  const socketRef = useRef<WebSocket | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const activeTypingChatIdRef = useRef<string | null>(null)
  const userIdRef = useRef('')
  const chatsRef = useRef<ChatSummary[]>([])
  const selectedChatIdRef = useRef<string | null>(null)
  const threadsRef = useRef<Record<string, ChatThread>>({})
  const readMarkersRef = useRef<Record<string, string>>({})
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const peerConnectionSessionRef = useRef<PeerConnectionSession | null>(null)
  const peerConnectionSequenceRef = useRef(0)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null)
  const queuedIceCandidatesRef = useRef<RTCIceCandidateInit[]>([])
  const remoteDescriptionReadyRef = useRef(false)
  const activeCallStateRef = useRef<ActiveCallState | null>(null)
  const pendingCallInitializationRef = useRef<{
    callId: string
    chatId: string
    participant: string
    direction: ActiveCallState['direction']
  } | null>(null)

  const [serverUrl, setServerUrl] = useState(DEFAULT_WS_URL)
  const [userId, setUserId] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [users, setUsers] = useState<Record<string, UserPresence>>({})
  const [chats, setChats] = useState<ChatSummary[]>([])
  const [threads, setThreads] = useState<Record<string, ChatThread>>({})
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newChatUserId, setNewChatUserId] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isMobileLayout, setIsMobileLayout] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches
      : false,
  )
  const [remoteTypingByChatId, setRemoteTypingByChatId] = useState<Record<string, string>>({})
  const [readMarkers, setReadMarkers] = useState<Record<string, string>>({})
  const [activeCallState, setActiveCallState] = useState<ActiveCallState | null>(null)
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null)
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null)
  const [eventLog, setEventLog] = useState<string[]>([
    '[09:00:12] Client initialized from swagger contract.',
  ])

  const selectedThread = selectedChatId ? threads[selectedChatId] ?? null : null
  const selectedChatSummary = selectedChatId
    ? chats.find((chat) => chat.chatId === selectedChatId) ?? null
    : null
  const selectedUser = selectedThread ? users[selectedThread.participant] ?? null : null
  const remoteTypingLabel = selectedChatId ? remoteTypingByChatId[selectedChatId] ?? null : null
  const showWelcome = status !== 'connected'
  const isDrafting = Boolean(messageDraft.trim())
  const isMobileChatOpen = isMobileLayout && Boolean(selectedChatId)
  const selectedCallState =
    activeCallState && activeCallState.chatId === selectedChatId
      ? activeCallState
      : null
  const selectedCallPhase = selectedCallState?.phase ?? 'idle'

  userIdRef.current = userId.trim()
  chatsRef.current = chats
  selectedChatIdRef.current = selectedChatId
  threadsRef.current = threads
  readMarkersRef.current = readMarkers
  activeCallStateRef.current = activeCallState

  const clearTypingRefreshTimer = useCallback(() => {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current)
      typingTimerRef.current = null
    }
  }, [])

  const logWebRtc = useCallback((label: string, details?: unknown) => {
    if (typeof details === 'undefined') {
      console.log(label)
      setEventLog((current) => appendLog(current, label))
      return
    }

    console.log(label, details)

    let detailsText = ''

    if (typeof details === 'string') {
      detailsText = details
    } else if (
      typeof details === 'number' ||
      typeof details === 'boolean' ||
      details === null
    ) {
      detailsText = String(details)
    } else if (details instanceof Error) {
      detailsText = details.message
    } else {
      try {
        detailsText = JSON.stringify(details)
      } catch {
        detailsText = String(details)
      }
    }

    setEventLog((current) =>
      appendLog(current, detailsText ? `${label}: ${detailsText}` : label),
    )
  }, [])

  const logCallSession = useCallback((
    label: string,
    details?: Record<string, unknown>,
  ) => {
    const session = peerConnectionSessionRef.current

    logWebRtc(label, {
      callId: session?.callId ?? pendingCallInitializationRef.current?.callId ?? null,
      chatId: session?.chatId ?? pendingCallInitializationRef.current?.chatId ?? null,
      participant: session?.participant ?? pendingCallInitializationRef.current?.participant ?? null,
      peerConnectionId: session?.peerConnectionId ?? null,
      ...details,
    })
  }, [logWebRtc])

  const sendTypingCommand = useCallback((
    payload: TypingCommand,
    options?: { log?: boolean },
  ): boolean => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return false
    }

    sendWebSocketCommand(socketRef.current, payload)

    if (options?.log ?? true) {
      setEventLog((current) => appendLog(current, `Sent: ${JSON.stringify(payload)}`))
    }

    return true
  }, [])

  const startLocalTyping = useCallback((
    chatId: string,
    options?: { log?: boolean },
  ): boolean => {
    const didSend = sendTypingCommand(
      {
        type: 'TYPING_START',
        chatId,
      },
      options,
    )

    activeTypingChatIdRef.current = didSend ? chatId : null
    return didSend
  }, [sendTypingCommand])

  const stopLocalTyping = useCallback((
    chatId = activeTypingChatIdRef.current,
    options?: { log?: boolean },
  ) => {
    clearTypingRefreshTimer()
    activeTypingChatIdRef.current = null

    if (!chatId) {
      return
    }

    void sendTypingCommand(
      {
        type: 'TYPING_END',
        chatId,
      },
      options,
    )
  }, [clearTypingRefreshTimer, sendTypingCommand])

  const appendSystemMessage = useCallback((chatId: string | null, text: string) => {
    if (!chatId) {
      return
    }

    const systemMessage: ChatMessage = {
      id: `system-${chatId}-${Date.now()}`,
      chatId,
      senderUserId: 'system',
      direction: 'system',
      text,
      timestamp: new Date().toISOString(),
    }

    setThreads((current) => {
      const existing = current[chatId]
      if (!existing) {
        return current
      }

      return {
        ...current,
        [chatId]: {
          ...existing,
          messages: [...existing.messages, systemMessage],
        },
      }
    })
  }, [])

  const sendCallSignal = useCallback((
    payload: CallSignalPayload,
    options?: { log?: boolean },
  ): boolean => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return false
    }

    const command: SendMessageCommand = {
      type: 'MESSAGE',
      chatId: payload.chatId,
      text: buildCallSignalText(payload),
    }

    sendWebSocketCommand(socketRef.current, command)

    if (options?.log ?? true) {
      setEventLog((current) =>
        appendLog(
          current,
          `Sent call signal: ${payload.kind} (${payload.chatId}/${payload.callId})`,
        ),
      )
    }

    return true
  }, [])

  const resetCallSession = useCallback((reason = 'unspecified') => {
    const peerConnection = peerConnectionRef.current
    const session = peerConnectionSessionRef.current
    const stackTrace = buildCleanupStackTrace()

    if (peerConnection) {
      logWebRtc('WebRTC peer connection closing', {
        ...(session ?? {}),
        reason,
        stackTrace,
      })
      peerConnection.onicecandidate = null
      peerConnection.onicecandidateerror = null
      peerConnection.oniceconnectionstatechange = null
      peerConnection.onicegatheringstatechange = null
      peerConnection.ontrack = null
      peerConnection.onconnectionstatechange = null
      peerConnection.onsignalingstatechange = null
      peerConnection.close()
      peerConnectionRef.current = null
    }

    logWebRtc('WebRTC call cleanup executed', {
      ...(session ?? {}),
      reason,
      stackTrace,
    })

    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop())

    peerConnectionSessionRef.current = null
    pendingCallInitializationRef.current = null
    localStreamRef.current = null
    remoteStreamRef.current = null
    pendingOfferRef.current = null
    queuedIceCandidatesRef.current = []
    remoteDescriptionReadyRef.current = false

    setLocalCallStream(null)
    setRemoteCallStream(null)
    setActiveCallState(null)
  }, [logWebRtc])

  const requestLocalAudioStream = useCallback(async () => {
    if (localStreamRef.current) {
      return localStreamRef.current
    }

    const availabilityError = getAudioInputAvailabilityError()

    if (availabilityError) {
      throw new Error(availabilityError)
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream
      setLocalCallStream(stream)
      return stream
    } catch (error) {
      const message = toAudioStreamErrorMessage(error)

      if (message) {
        throw new Error(message)
      }

      throw error
    }
  }, [])

  const attachLocalAudioTracks = useCallback((peerConnection: RTCPeerConnection, stream: MediaStream) => {
    const senderTrackIds = new Set(
      peerConnection
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter((trackId): trackId is string => Boolean(trackId)),
    )

    for (const track of stream.getTracks()) {
      if (!senderTrackIds.has(track.id)) {
        peerConnection.addTrack(track, stream)
      }
    }
  }, [])

  const flushQueuedIceCandidates = useCallback(async (
    peerConnection: RTCPeerConnection,
    session: PeerConnectionSession,
  ) => {
    if (queuedIceCandidatesRef.current.length === 0) {
      return
    }

    const queuedCandidates = [...queuedIceCandidatesRef.current]
    queuedIceCandidatesRef.current = []

    await Promise.all(
      queuedCandidates.map(async (candidate) => {
        try {
          await peerConnection.addIceCandidate(candidate)
          logWebRtc('WebRTC addIceCandidate success', {
            ...session,
            candidate,
            queued: true,
          })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Cannot apply remote ICE candidate.'
          logWebRtc('WebRTC addIceCandidate failure', {
            ...session,
            candidate,
            message,
            queued: true,
          })
          setEventLog((current) => appendLog(current, message))
        }
      }),
    )
  }, [logWebRtc])

  const createPeerConnection = useCallback((
    chatId: string,
    participant: string,
    callId: string,
  ) => {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC audio calling is not supported in this browser.')
    }

    const existingPeerConnection = peerConnectionRef.current
    const existingSession = peerConnectionSessionRef.current

    if (existingPeerConnection && existingSession) {
      if (existingSession.callId === callId && existingSession.chatId === chatId) {
        logWebRtc('WebRTC peer connection reused', existingSession)
        return existingPeerConnection
      }

      logWebRtc('WebRTC duplicate peer connection blocked', {
        requestedCallId: callId,
        requestedChatId: chatId,
        requestedParticipant: participant,
        existingSession,
      })
      throw new Error('Another audio call session is already active.')
    }

    const rtcConfig: RTCConfiguration = {
      iceServers: DEFAULT_WEBRTC_ICE_SERVERS,
      // iceTransportPolicy: 'relay',
    }

    console.log('RTC config full', rtcConfig)

    const peerConnection = new RTCPeerConnection(rtcConfig)
    const session: PeerConnectionSession = {
      callId,
      chatId,
      participant,
      peerConnectionId: ++peerConnectionSequenceRef.current,
    }

    peerConnectionRef.current = peerConnection
    peerConnectionSessionRef.current = session

    logWebRtc('WebRTC peer connection created', {
      ...session,
      iceServers: DEFAULT_WEBRTC_ICE_SERVERS.map((server) => server.urls),
    })

    remoteDescriptionReadyRef.current = false
    queuedIceCandidatesRef.current = []
    remoteStreamRef.current = new MediaStream()
    setRemoteCallStream(remoteStreamRef.current)

    peerConnection.onicecandidate = (event) => {
      if (peerConnectionRef.current !== peerConnection || peerConnectionSessionRef.current?.callId !== callId) {
        logWebRtc('WebRTC stale icecandidate ignored', session)
        return
      }

      logWebRtc('WebRTC icecandidate', {
        ...session,
        candidate: event.candidate?.candidate ?? '[gathering complete]',
      })

      if (!event.candidate) {
        return
      }

      logWebRtc('WebRTC local candidate send', {
        ...session,
        candidate: event.candidate.toJSON(),
      })

      void sendCallSignal(
        {
          version: 1,
          kind: 'ice-candidate',
          chatId,
          callId,
          candidate: event.candidate.toJSON(),
        },
        { log: false },
      )
    }

    peerConnection.onicecandidateerror = (event) => {
      logWebRtc('WebRTC icecandidateerror', {
        ...session,
        address: event.address,
        port: event.port,
        url: event.url,
        errorCode: event.errorCode,
        errorText: event.errorText,
      })
    }

    peerConnection.oniceconnectionstatechange = () => {
      logWebRtc('WebRTC iceConnectionState', {
        ...session,
        iceConnectionState: peerConnection.iceConnectionState,
      })
    }

    peerConnection.onsignalingstatechange = () => {
      logWebRtc('WebRTC signalingState', {
        ...session,
        signalingState: peerConnection.signalingState,
      })
    }

    peerConnection.onicegatheringstatechange = () => {
      logWebRtc('WebRTC iceGatheringState', {
        ...session,
        iceGatheringState: peerConnection.iceGatheringState,
      })
    }

    peerConnection.ontrack = (event) => {
      if (peerConnectionRef.current !== peerConnection || peerConnectionSessionRef.current?.callId !== callId) {
        logWebRtc('WebRTC stale ontrack ignored', session)
        return
      }

      logWebRtc('WebRTC ontrack', {
        ...session,
        trackId: event.track.id,
        kind: event.track.kind,
        streams: event.streams.map((stream) => stream.id),
      })

      if (event.streams[0]) {
        remoteStreamRef.current = event.streams[0]
        setRemoteCallStream(event.streams[0])
      } else if (remoteStreamRef.current) {
        remoteStreamRef.current.addTrack(event.track)
        setRemoteCallStream(remoteStreamRef.current)
      }

      setActiveCallState((current) =>
        current && current.callId === callId
          ? { ...current, phase: 'active' }
          : current,
      )
    }

    peerConnection.onconnectionstatechange = () => {
      const { connectionState } = peerConnection
      logWebRtc('WebRTC connectionState', {
        ...session,
        connectionState,
      })

      if (connectionState === 'connected') {
        setActiveCallState((current) =>
          current && current.callId === callId
            ? { ...current, phase: 'active' }
            : current,
        )
        return
      }

      if (
        connectionState === 'disconnected' ||
        connectionState === 'failed' ||
        connectionState === 'closed'
      ) {
        if (
          peerConnectionRef.current === peerConnection &&
          activeCallStateRef.current?.callId === callId
        ) {
          setEventLog((current) =>
            appendLog(current, `Call with ${participant} ended (${connectionState}).`),
          )
          resetCallSession(`connection-state:${connectionState}`)
        }
      }
    }

    return peerConnection
  }, [logWebRtc, resetCallSession, sendCallSignal])

  const endActiveCall = useCallback((options?: { notifyRemote?: boolean }) => {
    const activeCall = activeCallStateRef.current

    if (activeCall && options?.notifyRemote) {
      void sendCallSignal(
        {
          version: 1,
          kind: 'end',
          chatId: activeCall.chatId,
          callId: activeCall.callId,
        },
        { log: false },
      )
    }

    resetCallSession(options?.notifyRemote ? 'explicit-hangup' : 'local-call-end')
  }, [resetCallSession, sendCallSignal])

  const rejectIncomingCall = useCallback((reason = 'declined') => {
    const activeCall = activeCallStateRef.current

    if (!activeCall || activeCall.phase !== 'incoming') {
      return
    }

    void sendCallSignal(
      {
        version: 1,
        kind: 'reject',
        chatId: activeCall.chatId,
        callId: activeCall.callId,
        reason,
      },
      { log: false },
    )

    resetCallSession(`incoming-call-rejected:${reason}`)
  }, [resetCallSession, sendCallSignal])

  const handleStartCall = useCallback(async () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setEventLog((current) => appendLog(current, 'Connect first.'))
      return
    }

    if (!selectedThread) {
      setEventLog((current) => appendLog(current, 'Select a chat before starting a call.'))
      return
    }

    if (activeCallStateRef.current || pendingCallInitializationRef.current) {
      logCallSession('WebRTC start call ignored', {
        reason: activeCallStateRef.current ? 'active-call-exists' : 'call-initialization-in-progress',
      })
      return
    }

    const callId = createCallId()
    const nextInitialization = {
      callId,
      chatId: selectedThread.chatId,
      participant: selectedThread.participant,
      direction: 'outgoing' as const,
    }

    pendingCallInitializationRef.current = nextInitialization

    try {
      const stream = await requestLocalAudioStream()
      const peerConnection = createPeerConnection(
        selectedThread.chatId,
        selectedThread.participant,
        callId,
      )

      attachLocalAudioTracks(peerConnection, stream)

      setActiveCallState({
        chatId: selectedThread.chatId,
        callId,
        participant: selectedThread.participant,
        direction: 'outgoing',
        phase: 'outgoing',
      })

      logWebRtc('WebRTC offer creation started', {
        ...peerConnectionSessionRef.current,
      })
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
      })

      await peerConnection.setLocalDescription(offer)
      logWebRtc('WebRTC local offer applied', {
        ...peerConnectionSessionRef.current,
        sdp: offer.sdp ?? '',
      })

      void sendCallSignal({
        version: 1,
        kind: 'offer',
        chatId: selectedThread.chatId,
        callId,
        sdp: offer.sdp ?? '',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Cannot start audio call right now.'
      setEventLog((current) => appendLog(current, message))
      resetCallSession('start-call-failed')
      return
    } finally {
      if (pendingCallInitializationRef.current?.callId === callId) {
        pendingCallInitializationRef.current = null
      }
    }
  }, [
    attachLocalAudioTracks,
    createPeerConnection,
    logCallSession,
    logWebRtc,
    pendingCallInitializationRef,
    requestLocalAudioStream,
    resetCallSession,
    selectedThread,
    sendCallSignal,
  ])

  const handleAcceptCall = useCallback(async () => {
    const activeCall = activeCallStateRef.current

    if (
      !activeCall ||
      activeCall.phase !== 'incoming' ||
      !pendingOfferRef.current ||
      pendingCallInitializationRef.current
    ) {
      return
    }

    pendingCallInitializationRef.current = {
      callId: activeCall.callId,
      chatId: activeCall.chatId,
      participant: activeCall.participant,
      direction: 'incoming',
    }

    try {
      const stream = await requestLocalAudioStream()
      const peerConnection = createPeerConnection(
        activeCall.chatId,
        activeCall.participant,
        activeCall.callId,
      )

      attachLocalAudioTracks(peerConnection, stream)
      logWebRtc('WebRTC remote offer apply started', peerConnectionSessionRef.current ?? undefined)
      await peerConnection.setRemoteDescription(pendingOfferRef.current)
      remoteDescriptionReadyRef.current = true
      logWebRtc('WebRTC remote offer applied', peerConnectionSessionRef.current ?? undefined)
      await flushQueuedIceCandidates(peerConnection, peerConnectionSessionRef.current!)

      logWebRtc('WebRTC answer creation started', peerConnectionSessionRef.current ?? undefined)
      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      logWebRtc('WebRTC local answer applied', {
        ...peerConnectionSessionRef.current,
        sdp: answer.sdp ?? '',
      })
      pendingOfferRef.current = null

      setActiveCallState({
        ...activeCall,
        phase: 'connecting',
      })

      void sendCallSignal({
        version: 1,
        kind: 'answer',
        chatId: activeCall.chatId,
        callId: activeCall.callId,
        sdp: answer.sdp ?? '',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Cannot accept audio call right now.'
      setEventLog((current) => appendLog(current, message))
      rejectIncomingCall('media-unavailable')
      return
    } finally {
      if (pendingCallInitializationRef.current?.callId === activeCall.callId) {
        pendingCallInitializationRef.current = null
      }
    }
  }, [
    attachLocalAudioTracks,
    createPeerConnection,
    flushQueuedIceCandidates,
    logWebRtc,
    pendingCallInitializationRef,
    rejectIncomingCall,
    requestLocalAudioStream,
    sendCallSignal,
  ])

  const upsertMessages = useCallback((
    chatId: string,
    participant: string,
    incomingMessages: ChatMessage[],
  ) => {
    setThreads((current) => {
      const existing = current[chatId]
      const seen = new Set(existing?.messages.map((message) => message.id) ?? [])
      const merged = existing?.messages ? [...existing.messages] : []

      for (const message of incomingMessages) {
        if (!seen.has(message.id)) {
          seen.add(message.id)
          merged.push(message)
        }
      }

      merged.sort((left, right) => left.timestamp.localeCompare(right.timestamp))

      return {
        ...current,
        [chatId]: {
          chatId,
          participant,
          messages: merged,
        },
      }
    })
  }, [])

  const syncChatPreview = useCallback((chatId: string, preview: string) => {
    setChats((current) =>
      current.map((chat) => (chat.chatId === chatId ? { ...chat, preview } : chat)),
    )
  }, [])

  const syncChatTimestamp = useCallback((chatId: string, lastMessageTimestamp: string) => {
    setChats((current) =>
      current.map((chat) =>
        chat.chatId === chatId ? { ...chat, lastMessageTimestamp } : chat,
      ),
    )
  }, [])

  const markChatAsRead = useCallback((
    chatId: string,
    timestamp: string | null | undefined,
  ) => {
    if (!timestamp) {
      return
    }

    setReadMarkers((current) => {
      const existing = current[chatId]

      if (existing && existing.localeCompare(timestamp) >= 0) {
        return current
      }

      return {
        ...current,
        [chatId]: timestamp,
      }
    })

    setChats((current) =>
      current.map((chat) =>
        chat.chatId === chatId ? { ...chat, unreadCount: 0 } : chat,
      ),
    )
  }, [])

  const handleSelectChat = useCallback((chatId: string) => {
    const activeCall = activeCallStateRef.current

    if (activeCall && activeCall.chatId !== chatId) {
      logCallSession('WebRTC intentional call replacement requested', {
        nextChatId: chatId,
        previousChatId: activeCall.chatId,
      })
      endActiveCall({ notifyRemote: true })
    }

    setSelectedChatId(chatId)
    setIsHistoryLoading(true)
  }, [endActiveCall, logCallSession])

  const hydrateChatSummaries = useCallback(async (
    currentUserId: string,
    chatSummaries: ChatSummary[],
  ) => {
    if (chatSummaries.length === 0) {
      return
    }

    const historyResults = await Promise.allSettled(
      chatSummaries.map(async (chat) => {
        const payload = filterVisibleMessages(
          await fetchMessages(serverUrl, currentUserId, chat.chatId),
        )
        const latestMessage = payload.at(-1)
        const readMarker = readMarkersRef.current[chat.chatId]

        return {
          chatId: chat.chatId,
          preview: latestMessage?.text ?? '',
          lastMessageTimestamp: latestMessage?.timestamp,
          unreadCount: countUnreadMessages(payload, currentUserId, readMarker),
        }
      }),
    )

    const failedChats = historyResults.filter((result) => result.status === 'rejected')

    if (failedChats.length > 0) {
      setEventLog((current) =>
        appendLog(
          current,
          `Could not hydrate ${failedChats.length} chat preview${failedChats.length === 1 ? '' : 's'} during login.`,
        ),
      )
    }

    const nextByChatId = new Map<
      string,
      { preview: string; lastMessageTimestamp?: string; unreadCount: number }
    >()

    for (const result of historyResults) {
      if (result.status === 'fulfilled') {
        nextByChatId.set(result.value.chatId, {
          preview: result.value.preview,
          lastMessageTimestamp: result.value.lastMessageTimestamp,
          unreadCount: result.value.unreadCount,
        })
      }
    }

    setChats((current) =>
      current.map((chat) => {
        const hydrated = nextByChatId.get(chat.chatId)

        if (!hydrated) {
          return chat
        }

        const shouldKeepExistingTimestamp =
          Boolean(chat.lastMessageTimestamp) &&
          Boolean(hydrated.lastMessageTimestamp) &&
          chat.lastMessageTimestamp!.localeCompare(hydrated.lastMessageTimestamp!) > 0

        if (shouldKeepExistingTimestamp) {
          return chat
        }

        return {
          ...chat,
          preview: hydrated.preview || chat.preview,
          lastMessageTimestamp: hydrated.lastMessageTimestamp ?? chat.lastMessageTimestamp,
          unreadCount:
            selectedChatIdRef.current === chat.chatId ? 0 : hydrated.unreadCount,
        }
      }),
    )
  }, [serverUrl])

  const refreshUsers = useCallback(async (currentUserId: string) => {
    const payload = await fetchUsers(serverUrl, currentUserId)

    setUsers((current) => {
      const next: Record<string, UserPresence> = {}

      for (const user of payload) {
        next[user.username] = {
          ...user,
          lastPingReceivedAt: current[user.username]?.lastPingReceivedAt ?? null,
        }
      }

      return next
    })
  }, [serverUrl])

  const refreshChats = useCallback(async (currentUserId: string) => {
    const payload = await fetchChats(serverUrl, currentUserId)

    setChats((current) =>
      payload.map((chat) => {
        const existing = current.find((item) => item.chatId === chat.chatId)
        const hasHiddenPreview = Boolean(chat.preview && isCallSignalText(chat.preview))

        return {
          ...chat,
          preview: hasHiddenPreview ? existing?.preview : chat.preview ?? existing?.preview,
          lastMessageTimestamp: hasHiddenPreview
            ? existing?.lastMessageTimestamp
            : chat.lastMessageTimestamp ?? existing?.lastMessageTimestamp,
          unreadCount: existing?.unreadCount ?? 0,
        }
      }),
    )

    setSelectedChatId((current) => {
      if (current && payload.some((chat) => chat.chatId === current)) {
        return current
      }

      return null
    })

    await hydrateChatSummaries(currentUserId, payload)
  }, [hydrateChatSummaries, serverUrl])

  const loadHistory = useCallback(async (chatId: string, currentUserId: string) => {
    const chat = chatsRef.current.find((entry) => entry.chatId === chatId)
    if (!chat) {
      return
    }

    const payload = filterVisibleMessages(
      await fetchMessages(serverUrl, currentUserId, chatId),
    )
    const normalized = payload.map((message) => toChatMessage(message, currentUserId))
    const latestMessage = normalized.at(-1)

    upsertMessages(chatId, chat.username, normalized)
    syncChatPreview(chatId, latestMessage?.text ?? '')

    if (latestMessage) {
      syncChatTimestamp(chatId, latestMessage.timestamp)
      markChatAsRead(chatId, latestMessage.timestamp)
    }
  }, [markChatAsRead, serverUrl, syncChatPreview, syncChatTimestamp, upsertMessages])

  const handleCallSignalMessage = useCallback(async (
    payloadMessage: MessageRecord,
    signal: CallSignalPayload,
  ) => {
    const currentUserId = userIdRef.current

    if (payloadMessage.senderUserId === currentUserId) {
      return
    }

    const chat = chatsRef.current.find((entry) => entry.chatId === signal.chatId)
    const participant = chat?.username ?? payloadMessage.senderUserId
    const activeCall = activeCallStateRef.current

    setEventLog((current) =>
      appendLog(current, `Received call signal: ${signal.kind} (${signal.chatId}/${signal.callId})`),
    )

    if (signal.kind === 'offer') {
      if (activeCall && activeCall.callId !== signal.callId) {
        void sendCallSignal(
          {
            version: 1,
            kind: 'reject',
            chatId: signal.chatId,
            callId: signal.callId,
            reason: 'busy',
          },
          { log: false },
        )
        return
      }

      if (activeCall?.callId === signal.callId) {
        return
      }

      pendingOfferRef.current = {
        type: 'offer',
        sdp: signal.sdp,
      }
      queuedIceCandidatesRef.current = []
      remoteDescriptionReadyRef.current = false
      logWebRtc('WebRTC remote offer received', {
        chatId: signal.chatId,
        callId: signal.callId,
        participant,
      })

      if (selectedChatIdRef.current !== signal.chatId) {
        setSelectedChatId(signal.chatId)
        setIsHistoryLoading(true)
      } else if (!threadsRef.current[signal.chatId] && currentUserId) {
        setIsHistoryLoading(true)
        void loadHistory(signal.chatId, currentUserId)
          .catch((error: Error) => {
            setEventLog((current) =>
              appendLog(current, `Cannot load history: ${error.message}`),
            )
          })
          .finally(() => {
            setIsHistoryLoading(false)
          })
      }

      setActiveCallState({
        chatId: signal.chatId,
        callId: signal.callId,
        participant,
        direction: 'incoming',
        phase: 'incoming',
      })
      return
    }

    if (!activeCall || activeCall.callId !== signal.callId || activeCall.chatId !== signal.chatId) {
      return
    }

    switch (signal.kind) {
      case 'answer': {
        const peerConnection = peerConnectionRef.current
        const session = peerConnectionSessionRef.current

        if (
          !peerConnection ||
          !session ||
          session.callId !== signal.callId ||
          session.chatId !== signal.chatId
        ) {
          logWebRtc('WebRTC answer ignored for non-current session', {
            signalCallId: signal.callId,
            signalChatId: signal.chatId,
            session,
          })
          return
        }

        logWebRtc('WebRTC answer apply started', {
          ...session,
          sdp: signal.sdp,
        })
        await peerConnection.setRemoteDescription({
          type: 'answer',
          sdp: signal.sdp,
        })
        remoteDescriptionReadyRef.current = true
        logWebRtc('WebRTC answer applied', session)
        await flushQueuedIceCandidates(peerConnection, session)
        setActiveCallState({
          ...activeCall,
          phase: 'connecting',
        })
        return
      }
      case 'ice-candidate': {
        const peerConnection = peerConnectionRef.current
        const session = peerConnectionSessionRef.current

        if (
          !session ||
          session.callId !== signal.callId ||
          session.chatId !== signal.chatId
        ) {
          logWebRtc('WebRTC remote candidate ignored for non-current session', {
            signalCallId: signal.callId,
            signalChatId: signal.chatId,
            session,
            candidate: signal.candidate,
          })
          return
        }

        logWebRtc('WebRTC remote candidate received', {
          ...session,
          candidate: signal.candidate,
        })

        if (!peerConnection || !remoteDescriptionReadyRef.current) {
          queuedIceCandidatesRef.current.push(signal.candidate)
          logWebRtc('WebRTC remote candidate queued', {
            ...session,
            candidate: signal.candidate,
            queueLength: queuedIceCandidatesRef.current.length,
          })
          return
        }

        try {
          await peerConnection.addIceCandidate(signal.candidate)
          logWebRtc('WebRTC addIceCandidate success', {
            ...session,
            candidate: signal.candidate,
            queued: false,
          })
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Cannot apply remote ICE candidate.'
          logWebRtc('WebRTC addIceCandidate failure', {
            ...session,
            candidate: signal.candidate,
            message,
            queued: false,
          })
          setEventLog((current) => appendLog(current, message))
        }
        return
      }
      case 'reject':
        setEventLog((current) =>
          appendLog(
            current,
            `Call rejected by ${participant}${signal.reason ? ` (${signal.reason})` : '.'}`,
          ),
        )
        resetCallSession('remote-call-rejected')
        return
      case 'end':
        setEventLog((current) => appendLog(current, `Call ended by ${participant}.`))
        resetCallSession('remote-call-ended')
        return
      default:
        return
    }
  }, [flushQueuedIceCandidates, loadHistory, logWebRtc, resetCallSession, sendCallSignal])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches)
    }

    setIsMobileLayout(mediaQuery.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const root = document.documentElement
    const viewport = window.visualViewport

    const syncVisibleViewport = () => {
      const visibleHeight = viewport?.height ?? window.innerHeight
      const visibleOffsetTop = viewport?.offsetTop ?? 0

      root.style.setProperty('--app-visible-height', `${visibleHeight}px`)
      root.style.setProperty('--app-visible-offset-top', `${visibleOffsetTop}px`)
    }

    syncVisibleViewport()

    viewport?.addEventListener('resize', syncVisibleViewport)
    viewport?.addEventListener('scroll', syncVisibleViewport)
    window.addEventListener('resize', syncVisibleViewport)

    return () => {
      viewport?.removeEventListener('resize', syncVisibleViewport)
      viewport?.removeEventListener('scroll', syncVisibleViewport)
      window.removeEventListener('resize', syncVisibleViewport)
    }
  }, [])

  useEffect(() => {
    logWebRtc('WebRTC component cleanup effect mounted')

    return () => {
      logWebRtc('WebRTC component cleanup effect running', {
        selectedChatId: selectedChatIdRef.current,
        activeCall: activeCallStateRef.current,
      })
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
      }

      clearTypingRefreshTimer()
      resetCallSession('component-unmount')

      socketRef.current?.close()
    }
  }, [clearTypingRefreshTimer, logWebRtc, resetCallSession])

  useEffect(() => {
    logWebRtc('WebRTC selected chat changed', {
      selectedChatId,
      activeCall: activeCallStateRef.current,
      pendingInitialization: pendingCallInitializationRef.current,
    })
  }, [logWebRtc, selectedChatId])

  useEffect(() => {
    logWebRtc('WebRTC active call state changed', activeCallState)
  }, [activeCallState, logWebRtc])

  useEffect(() => {
    const currentUserId = userId.trim()

    if (!currentUserId) {
      return
    }

    saveReadMarkers(currentUserId, readMarkers)
  }, [readMarkers, userId])

  useEffect(() => {
    const currentUserId = userId.trim()

    if (!selectedChatId || !currentUserId) {
      return
    }

    setIsHistoryLoading(true)
    loadHistory(selectedChatId, currentUserId).catch((error: Error) => {
      setEventLog((current) => appendLog(current, `Cannot load history: ${error.message}`))
      appendSystemMessage(selectedChatId, `Cannot load history: ${error.message}`)
    }).finally(() => {
      setIsHistoryLoading(false)
    })
  }, [appendSystemMessage, loadHistory, selectedChatId, userId])

  useEffect(() => {
    if (status !== 'connected' || !userId.trim()) {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }

      return
    }

    const runPing = () => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        return
      }

      const pingPayload: PingCommand = { type: 'PRESENCE' }
      sendWebSocketCommand(socketRef.current, pingPayload)
      setEventLog((current) => appendLog(current, `Sent: ${JSON.stringify(pingPayload)}`))
    }

    runPing()
    pingTimerRef.current = window.setInterval(runPing, PRESENCE_PING_INTERVAL_MS)

    return () => {
      if (pingTimerRef.current !== null) {
        window.clearInterval(pingTimerRef.current)
        pingTimerRef.current = null
      }
    }
  }, [serverUrl, status, userId])

  useEffect(() => {
    const nextChatId = selectedChatId
    const trimmedDraft = messageDraft.trim()

    if (status !== 'connected' || !nextChatId || !trimmedDraft) {
      if (activeTypingChatIdRef.current) {
        stopLocalTyping(activeTypingChatIdRef.current)
      } else {
        clearTypingRefreshTimer()
      }

      return
    }

    if (activeTypingChatIdRef.current && activeTypingChatIdRef.current !== nextChatId) {
      stopLocalTyping(activeTypingChatIdRef.current)
    }

    if (activeTypingChatIdRef.current !== nextChatId) {
      const didStart = startLocalTyping(nextChatId)

      if (!didStart) {
        return
      }
    }

    clearTypingRefreshTimer()
    typingTimerRef.current = window.setInterval(() => {
      const chatId = activeTypingChatIdRef.current

      if (!chatId) {
        return
      }

      void sendTypingCommand(
        {
          type: 'TYPING_START',
          chatId,
        },
        { log: false },
      )
    }, TYPING_REFRESH_INTERVAL_MS)

    return () => {
      clearTypingRefreshTimer()
    }
  }, [
    clearTypingRefreshTimer,
    messageDraft,
    selectedChatId,
    sendTypingCommand,
    startLocalTyping,
    status,
    stopLocalTyping,
  ])

  const handleConnect = () => {
    const currentUserId = userId.trim()

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      setEventLog((current) => appendLog(current, 'Already connected.'))
      return
    }

    if (!serverUrl.trim() || !currentUserId) {
      setEventLog((current) =>
        appendLog(current, 'Server URL and user ID are required.'),
      )
      return
    }

    const url = buildWebSocketUrl(serverUrl, currentUserId)
    const socket = new WebSocket(url)
    socketRef.current = socket

    setStatus('connecting')
    setEventLog((current) => appendLog(current, `Connecting to ${url}`))

    socket.onopen = () => {
      setStatus('connected')
      setIsBootstrapping(true)
      setReadMarkers(loadReadMarkers(currentUserId))
      setEventLog((current) => appendLog(current, `WebSocket connected as ${currentUserId}.`))

      Promise.all([refreshChats(currentUserId), refreshUsers(currentUserId)]).catch(
        (error: Error) => {
          setEventLog((current) =>
            appendLog(current, `Cannot load initial data: ${error.message}`),
          )
        },
      ).finally(() => {
        setIsBootstrapping(false)
      })
    }

    socket.onmessage = (event) => {
      const raw = String(event.data)
      setEventLog((current) => appendLog(current, `Received: ${raw}`))

      if (raw.startsWith('CONNECTED:')) {
        return
      }

      if (raw.startsWith('ERROR:')) {
        appendSystemMessage(selectedChatId, raw)
        return
      }

      let payload: unknown

      try {
        payload = JSON.parse(raw) as WebSocketIncomingEvent
      } catch {
        setEventLog((current) => appendLog(current, `Ignored non-JSON message: ${raw}`))
        return
      }

      if (isMessageRecord(payload) && isCallSignalText(payload.text)) {
        const signal = parseCallSignalText(payload.text)

        if (!signal) {
          setEventLog((current) =>
            appendLog(current, 'Ignored malformed hidden call signal message.'),
          )
          return
        }

        void handleCallSignalMessage(payload, signal)
        return
      }

      if (isPresenceEvent(payload)) {
        setUsers((current) => ({
          ...current,
          [payload.username]: {
            username: payload.username,
            lastPingTime: payload.lastPingTime,
            lastPingReceivedAt: Date.now(),
          },
        }))
        return
      }

      if (isTypingEvent(payload)) {
        if (payload.username && payload.username === userIdRef.current) {
          return
        }

        if (payload.type === 'typing:stop' || payload.type === 'TYPING_END') {
          setRemoteTypingByChatId((current) => {
            if (!current[payload.chatId]) {
              return current
            }

            const next = { ...current }
            delete next[payload.chatId]
            return next
          })
          return
        }

        const chat = chatsRef.current.find((entry) => entry.chatId === payload.chatId)
        const typingUser =
          payload.username && payload.username !== userIdRef.current
            ? payload.username
            : chat?.username ?? 'Someone'

        setRemoteTypingByChatId((current) => ({
          ...current,
          [payload.chatId]: typingUser,
        }))
        return
      }

      if (hasTypedEventShape(payload)) {
        if (
          payload.type === 'MESSAGE' &&
          isMessageRecord(payload)
        ) {
          const payloadMessage = payload
          const message: ChatMessage = {
            ...toChatMessage(payloadMessage, userIdRef.current),
            id: toMessageId(payloadMessage),
          }

          if (message.senderUserId !== userIdRef.current) {
            setRemoteTypingByChatId((current) => {
              if (!current[message.chatId]) {
                return current
              }

              const next = { ...current }
              delete next[message.chatId]
              return next
            })
          }

          const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
          upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])
          syncChatPreview(message.chatId, message.text)
          syncChatTimestamp(message.chatId, message.timestamp)

          setChats((current) => {
            if (!current.some((entry) => entry.chatId === message.chatId)) {
              void refreshChats(userIdRef.current)
              return current
            }

            if (selectedChatIdRef.current === message.chatId) {
              markChatAsRead(message.chatId, message.timestamp)
            }

            return current.map((entry) =>
              entry.chatId === message.chatId
                ? {
                    ...entry,
                    preview: message.text,
                    unreadCount:
                      selectedChatIdRef.current === message.chatId ||
                      message.senderUserId === userIdRef.current
                        ? 0
                        : (entry.unreadCount ?? 0) + 1,
                  }
                : entry,
            )
          })
          return
        }

        setEventLog((current) =>
          appendLog(
            current,
            `Ignored unsupported websocket event type: ${String(payload.type)}`,
          ),
        )
        return
      }

      if (!isMessageRecord(payload)) {
        setEventLog((current) =>
          appendLog(current, 'Ignored websocket payload with unsupported structure.'),
        )
        return
      }

      const payloadMessage = payload
      const message: ChatMessage = {
        ...toChatMessage(payloadMessage, userIdRef.current),
        id: toMessageId(payloadMessage),
      }

      if (message.senderUserId !== userIdRef.current) {
        setRemoteTypingByChatId((current) => {
          if (!current[message.chatId]) {
            return current
          }

          const next = { ...current }
          delete next[message.chatId]
          return next
        })
      }

      const chat = chatsRef.current.find((entry) => entry.chatId === message.chatId)
      upsertMessages(message.chatId, chat?.username ?? message.senderUserId, [message])
      syncChatPreview(message.chatId, message.text)
      syncChatTimestamp(message.chatId, message.timestamp)

      setChats((current) => {
        if (!current.some((entry) => entry.chatId === message.chatId)) {
          void refreshChats(userIdRef.current)
          return current
        }

        if (selectedChatIdRef.current === message.chatId) {
          markChatAsRead(message.chatId, message.timestamp)
        }

        return current.map((entry) =>
          entry.chatId === message.chatId
            ? {
                ...entry,
                preview: message.text,
                unreadCount:
                  selectedChatIdRef.current === message.chatId ||
                  message.senderUserId === userIdRef.current
                    ? 0
                    : (entry.unreadCount ?? 0) + 1,
              }
            : entry,
        )
      })
    }

    socket.onerror = () => {
      setEventLog((current) => appendLog(current, 'WebSocket error.'))
      appendSystemMessage(selectedChatId, 'WebSocket error.')
    }

    socket.onclose = () => {
      logWebRtc('WebRTC socket onclose cleanup', {
        selectedChatId: selectedChatIdRef.current,
        activeCall: activeCallStateRef.current,
      })
      setStatus('disconnected')
      setIsBootstrapping(false)
      setIsHistoryLoading(false)
      setEventLog((current) => appendLog(current, 'WebSocket closed.'))
      setChats([])
      setRemoteTypingByChatId({})
      setUsers({})
      setThreads({})
      setSelectedChatId(null)
      setReadMarkers({})
      resetCallSession('socket-closed')
      clearTypingRefreshTimer()
      activeTypingChatIdRef.current = null
      socketRef.current = null
    }
  }

  const handleDisconnect = () => {
    if (!socketRef.current) {
      setEventLog((current) => appendLog(current, 'No active connection.'))
      return
    }

    endActiveCall({ notifyRemote: true })
    stopLocalTyping(activeTypingChatIdRef.current)
    socketRef.current.close()
  }

  const handleCreateChat = async () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setEventLog((current) => appendLog(current, 'Connect first.'))
      return
    }

    const currentUserId = userId.trim()
    const username = newChatUserId.trim().toLowerCase()

    if (!username) {
      setEventLog((current) => appendLog(current, 'Cannot create chat without a username.'))
      return
    }

    try {
      const chat = await createChat(serverUrl, currentUserId, username)
      setNewChatUserId('')
      setEventLog((current) => appendLog(current, `Chat created: ${chat.chatId}`))
      await Promise.all([refreshChats(currentUserId), refreshUsers(currentUserId)])
      setSelectedChatId(chat.chatId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Create chat failed.'
      setEventLog((current) => appendLog(current, `Create chat failed: ${message}`))
      appendSystemMessage(selectedChatId, `Create chat failed: ${message}`)
    }
  }

  const handleSendMessage = () => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setEventLog((current) => appendLog(current, 'Connect first.'))
      return
    }

    if (!selectedThread || !messageDraft.trim()) {
      setEventLog((current) => appendLog(current, 'Select a chat and enter a message.'))
      return
    }

    const payload: SendMessageCommand = {
      type: 'MESSAGE',
      chatId: selectedThread.chatId,
      text: messageDraft.trim(),
    }

    sendWebSocketCommand(socketRef.current, payload)
    setEventLog((current) => appendLog(current, `Sent: ${JSON.stringify(payload)}`))
    stopLocalTyping(selectedThread.chatId)
    setMessageDraft('')
  }

  const handleShellPointerMove = (event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top

    event.currentTarget.style.setProperty('--spotlight-x', `${x}px`)
    event.currentTarget.style.setProperty('--spotlight-y', `${y}px`)
  }

  const handleShellPointerLeave = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--spotlight-x', '50%')
    event.currentTarget.style.setProperty('--spotlight-y', '18%')
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="app-frame"
        variants={shellStagger}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          className="ambient ambient-one"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.72, scale: 1 }}
          transition={{ duration: 1.2 }}
        />
        <motion.div
          className="ambient ambient-two"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.62, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.08 }}
        />
        <motion.div
          className="ambient ambient-three"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 0.56, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.16 }}
        />

        <motion.main
          className={`app-shell ${showWelcome ? 'is-welcome-active' : ''}`}
          onPointerMove={handleShellPointerMove}
          onPointerLeave={handleShellPointerLeave}
          variants={shellStagger}
        >
          <AnimatePresence>
            {showWelcome ? (
              <WelcomeExperience
                serverUrl={serverUrl}
                userId={userId}
                status={status}
                onServerUrlChange={setServerUrl}
                onUserIdChange={setUserId}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ) : null}
          </AnimatePresence>

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
                  <ChatSidebar
                    currentUserId={userId.trim()}
                    chats={chats}
                    selectedChatId={selectedChatId}
                    users={users}
                    status={status}
	                  newChatUserId={newChatUserId}
	                  onNewChatUserIdChange={setNewChatUserId}
	                  onCreateChat={handleCreateChat}
	                  onSelectChat={handleSelectChat}
	                  onDisconnect={handleDisconnect}
	                />
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
                  <motion.div className="workspace-main" variants={shellStagger}>
                    <ConversationPanel
                      thread={selectedThread}
                      pendingParticipantName={selectedThread?.participant ?? selectedChatSummary?.username ?? null}
                      user={selectedUser}
                      currentUserId={userId.trim()}
                      isMobileLayout={isMobileLayout}
                      connectionStatus={status}
                      isHistoryLoading={isHistoryLoading || isBootstrapping}
                      isDrafting={isDrafting}
                      remoteTypingLabel={remoteTypingLabel}
                      callPhase={selectedCallPhase}
                      localCallStream={localCallStream}
                      remoteCallStream={remoteCallStream}
                      messageDraft={messageDraft}
                      onMessageDraftChange={setMessageDraft}
                      onBackToInbox={() => setSelectedChatId(null)}
                      onAcceptCall={handleAcceptCall}
                      onDeclineCall={rejectIncomingCall}
                      onEndCall={() => endActiveCall({ notifyRemote: true })}
                      onSendMessage={handleSendMessage}
                      onStartCall={handleStartCall}
                    />

                    <EventLogPanel lines={eventLog.slice(0, 18)} />
                  </motion.div>
                </motion.div>
              </div>
            ) : (
              <>
                <ChatSidebar
                  currentUserId={userId.trim()}
                  chats={chats}
                  selectedChatId={selectedChatId}
                  users={users}
                  status={status}
	                  newChatUserId={newChatUserId}
	                  onNewChatUserIdChange={setNewChatUserId}
	                  onCreateChat={handleCreateChat}
	                  onSelectChat={handleSelectChat}
	                  onDisconnect={handleDisconnect}
	                />

                <motion.div className="workspace-main" variants={shellStagger}>
                  <ConversationPanel
                    thread={selectedThread}
                    pendingParticipantName={selectedThread?.participant ?? selectedChatSummary?.username ?? null}
                    user={selectedUser}
                    currentUserId={userId.trim()}
                    isMobileLayout={isMobileLayout}
                    connectionStatus={status}
                    isHistoryLoading={isHistoryLoading || isBootstrapping}
                    isDrafting={isDrafting}
                    remoteTypingLabel={remoteTypingLabel}
                    callPhase={selectedCallPhase}
                    localCallStream={localCallStream}
                    remoteCallStream={remoteCallStream}
                    messageDraft={messageDraft}
                    onMessageDraftChange={setMessageDraft}
                    onBackToInbox={() => setSelectedChatId(null)}
                    onAcceptCall={handleAcceptCall}
                    onDeclineCall={rejectIncomingCall}
                    onEndCall={() => endActiveCall({ notifyRemote: true })}
                    onSendMessage={handleSendMessage}
                    onStartCall={handleStartCall}
                  />

                  <EventLogPanel lines={eventLog.slice(0, 18)} />
                </motion.div>
              </>
            )}
          </motion.section>
        </motion.main>
      </motion.div>
    </MotionConfig>
  )
}
