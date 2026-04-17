import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { sendWebSocketCommand } from '../../shared/api/chatApi'
import { DEFAULT_WEBRTC_ICE_SERVERS } from '../../shared/config/backend'
import type {
  ActiveCallState,
  CallSignalPayload,
  ChatSummary,
  ChatThread,
  MessageRecord,
  SendMessageCommand,
} from '../../shared/types/chat'
import { buildCallSignalText } from '../../shared/utils/callSignals'
import {
  buildCleanupStackTrace,
  createCallId,
  getAudioInputAvailabilityError,
  toAudioStreamErrorMessage,
} from '../utils/callSession'

interface PeerConnectionSession {
  callId: string
  chatId: string
  participant: string
  peerConnectionId: number
}

interface UseCallSessionArgs {
  appendEventLog: (message: string) => void
  chatsRef: MutableRefObject<ChatSummary[]>
  loadHistory: (chatId: string, currentUserId: string) => Promise<void>
  selectedChatIdRef: MutableRefObject<string | null>
  setIsHistoryLoading: Dispatch<SetStateAction<boolean>>
  setSelectedChatId: Dispatch<SetStateAction<string | null>>
  socketRef: MutableRefObject<WebSocket | null>
  threadsRef: MutableRefObject<Record<string, ChatThread>>
  userIdRef: MutableRefObject<string>
}

function stringifyLogDetails(details: unknown) {
  if (typeof details === 'undefined') {
    return ''
  }

  if (typeof details === 'string') {
    return details
  }

  if (typeof details === 'number' || typeof details === 'boolean' || details === null) {
    return String(details)
  }

  if (details instanceof Error) {
    return details.message
  }

  try {
    return JSON.stringify(details)
  } catch {
    return String(details)
  }
}

export function useCallSession({
  appendEventLog,
  chatsRef,
  loadHistory,
  selectedChatIdRef,
  setIsHistoryLoading,
  setSelectedChatId,
  socketRef,
  threadsRef,
  userIdRef,
}: UseCallSessionArgs) {
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
    direction: ActiveCallState['direction']
    participant: string
  } | null>(null)

  const [activeCallState, setActiveCallState] = useState<ActiveCallState | null>(null)
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null)
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null)

  const logWebRtc = useCallback((label: string, details?: unknown) => {
    if (typeof details === 'undefined') {
      console.log(label)
      appendEventLog(label)
      return
    }

    console.log(label, details)
    const detailsText = stringifyLogDetails(details)
    appendEventLog(detailsText ? `${label}: ${detailsText}` : label)
  }, [appendEventLog])

  useEffect(() => {
    activeCallStateRef.current = activeCallState
    logWebRtc('WebRTC active call state changed', activeCallState)
  }, [activeCallState, logWebRtc])

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

  const sendCallSignal = useCallback((
    payload: CallSignalPayload,
    options?: { log?: boolean },
  ) => {
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
      appendEventLog(`Sent call signal: ${payload.kind} (${payload.chatId}/${payload.callId})`)
    }

    return true
  }, [appendEventLog, socketRef])

  const cleanupCallSession = useCallback((reason = 'unspecified') => {
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

  const attachLocalAudioTracks = useCallback((
    peerConnection: RTCPeerConnection,
    stream: MediaStream,
  ) => {
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
          appendEventLog(message)
        }
      }),
    )
  }, [appendEventLog, logWebRtc])

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
        existingSession,
        requestedCallId: callId,
        requestedChatId: chatId,
        requestedParticipant: participant,
      })
      throw new Error('Another audio call session is already active.')
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: DEFAULT_WEBRTC_ICE_SERVERS,
      iceTransportPolicy: 'relay',
    })
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
      const currentSession = peerConnectionSessionRef.current

      if (peerConnectionRef.current !== peerConnection || currentSession?.callId !== callId) {
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
        errorCode: event.errorCode,
        errorText: event.errorText,
        port: event.port,
        url: event.url,
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
      const currentSession = peerConnectionSessionRef.current

      if (peerConnectionRef.current !== peerConnection || currentSession?.callId !== callId) {
        logWebRtc('WebRTC stale ontrack ignored', session)
        return
      }

      logWebRtc('WebRTC ontrack', {
        ...session,
        kind: event.track.kind,
        streams: event.streams.map((stream) => stream.id),
        trackId: event.track.id,
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
          appendEventLog(`Call with ${participant} ended (${connectionState}).`)
          cleanupCallSession(`connection-state:${connectionState}`)
        }
      }
    }

    return peerConnection
  }, [appendEventLog, cleanupCallSession, logWebRtc, sendCallSignal])

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

    cleanupCallSession(options?.notifyRemote ? 'explicit-hangup' : 'local-call-end')
  }, [cleanupCallSession, sendCallSignal])

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

    cleanupCallSession(`incoming-call-rejected:${reason}`)
  }, [cleanupCallSession, sendCallSignal])

  const startCall = useCallback(async (selectedThread: ChatThread | null) => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      appendEventLog('Connect first.')
      return
    }

    if (!selectedThread) {
      appendEventLog('Select a chat before starting a call.')
      return
    }

    if (activeCallStateRef.current || pendingCallInitializationRef.current) {
      logCallSession('WebRTC start call ignored', {
        reason: activeCallStateRef.current
          ? 'active-call-exists'
          : 'call-initialization-in-progress',
      })
      return
    }

    const callId = createCallId()
    pendingCallInitializationRef.current = {
      callId,
      chatId: selectedThread.chatId,
      direction: 'outgoing',
      participant: selectedThread.participant,
    }

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
        direction: 'outgoing',
        participant: selectedThread.participant,
        phase: 'outgoing',
      })

      logWebRtc('WebRTC offer creation started', peerConnectionSessionRef.current ?? undefined)
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
      appendEventLog(message)
      cleanupCallSession('start-call-failed')
      return
    } finally {
      if (pendingCallInitializationRef.current?.callId === callId) {
        pendingCallInitializationRef.current = null
      }
    }
  }, [
    appendEventLog,
    attachLocalAudioTracks,
    cleanupCallSession,
    createPeerConnection,
    logCallSession,
    logWebRtc,
    requestLocalAudioStream,
    sendCallSignal,
    socketRef,
  ])

  const acceptCall = useCallback(async () => {
    const activeCall = activeCallStateRef.current
    const pendingOffer = pendingOfferRef.current

    if (
      !activeCall ||
      activeCall.phase !== 'incoming' ||
      !pendingOffer ||
      pendingCallInitializationRef.current
    ) {
      return
    }

    pendingCallInitializationRef.current = {
      callId: activeCall.callId,
      chatId: activeCall.chatId,
      direction: 'incoming',
      participant: activeCall.participant,
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
      await peerConnection.setRemoteDescription(pendingOffer)
      remoteDescriptionReadyRef.current = true
      logWebRtc('WebRTC remote offer applied', peerConnectionSessionRef.current ?? undefined)

      const session = peerConnectionSessionRef.current
      if (session) {
        await flushQueuedIceCandidates(peerConnection, session)
      }

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
      appendEventLog(message)
      rejectIncomingCall('media-unavailable')
      return
    } finally {
      if (pendingCallInitializationRef.current?.callId === activeCall.callId) {
        pendingCallInitializationRef.current = null
      }
    }
  }, [
    appendEventLog,
    attachLocalAudioTracks,
    createPeerConnection,
    flushQueuedIceCandidates,
    logWebRtc,
    rejectIncomingCall,
    requestLocalAudioStream,
    sendCallSignal,
  ])

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

    appendEventLog(`Received call signal: ${signal.kind} (${signal.chatId}/${signal.callId})`)

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
        callId: signal.callId,
        chatId: signal.chatId,
        participant,
      })

      if (selectedChatIdRef.current !== signal.chatId) {
        setSelectedChatId(signal.chatId)
        setIsHistoryLoading(true)
      } else if (!threadsRef.current[signal.chatId] && currentUserId) {
        setIsHistoryLoading(true)
        void loadHistory(signal.chatId, currentUserId)
          .catch((error: Error) => {
            appendEventLog(`Cannot load history: ${error.message}`)
          })
          .finally(() => {
            setIsHistoryLoading(false)
          })
      }

      setActiveCallState({
        chatId: signal.chatId,
        callId: signal.callId,
        direction: 'incoming',
        participant,
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
            session,
            signalCallId: signal.callId,
            signalChatId: signal.chatId,
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
            session,
            signalCallId: signal.callId,
            signalChatId: signal.chatId,
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
          appendEventLog(message)
        }
        return
      }
      case 'reject':
        appendEventLog(
          `Call rejected by ${participant}${signal.reason ? ` (${signal.reason})` : '.'}`,
        )
        cleanupCallSession('remote-call-rejected')
        return
      case 'end':
        appendEventLog(`Call ended by ${participant}.`)
        cleanupCallSession('remote-call-ended')
        return
      default:
        return
    }
  }, [
    appendEventLog,
    chatsRef,
    cleanupCallSession,
    flushQueuedIceCandidates,
    loadHistory,
    logWebRtc,
    selectedChatIdRef,
    sendCallSignal,
    setIsHistoryLoading,
    setSelectedChatId,
    threadsRef,
    userIdRef,
  ])

  return {
    acceptCall,
    activeCallState,
    cleanupCallSession,
    endActiveCall,
    handleCallSignalMessage,
    localCallStream,
    rejectIncomingCall,
    remoteCallStream,
    startCall,
  }
}
