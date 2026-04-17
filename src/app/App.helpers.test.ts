import {
  appendLog,
} from './utils/eventLog'
import {
  countUnreadMessages,
  loadReadMarkers,
  saveReadMarkers,
} from './utils/readMarkers'
import {
  hasTypedEventShape,
  isMessageRecord,
  isPresenceEvent,
  isTypingEvent,
} from './utils/websocketPayloadGuards'

describe('App helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T09:08:07'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('prepends timestamped event log entries', () => {
    const lines = appendLog(['[09:00:00] Existing'], 'Connected')

    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Connected')
    expect(lines[0]).toMatch(/^\[/)
    expect(lines[1]).toBe('[09:00:00] Existing')
  })

  test('detects known websocket payload shapes', () => {
    expect(isPresenceEvent({ type: 'presence', username: 'bob', lastPingTime: null })).toBe(
      true,
    )
    expect(isTypingEvent({ type: 'TYPING_END', chatId: 'chat-1' })).toBe(true)
    expect(hasTypedEventShape({ type: 'MESSAGE' })).toBe(true)
    expect(
      isMessageRecord({
        chatId: 'chat-1',
        senderUserId: 'bob',
        text: 'Hello',
        timestamp: '2026-04-12T10:00:00Z',
      }),
    ).toBe(true)
    expect(isMessageRecord({ type: 'MESSAGE' })).toBe(false)
  })

  test('loads and saves read markers defensively', () => {
    saveReadMarkers('alice', { 'chat-1': '2026-04-12T10:00:00Z' })

    expect(loadReadMarkers('alice')).toEqual({
      'chat-1': '2026-04-12T10:00:00Z',
    })

    window.localStorage.setItem('whispers-read-markers:alice', 'broken json')

    expect(loadReadMarkers('alice')).toEqual({})
    expect(loadReadMarkers('')).toEqual({})
  })

  test('counts unread messages after the last read marker and ignores current user messages', () => {
    expect(
      countUnreadMessages(
        [
          { senderUserId: 'bob', timestamp: '2026-04-12T10:00:00Z' },
          { senderUserId: 'alice', timestamp: '2026-04-12T10:01:00Z' },
          { senderUserId: 'bob', timestamp: '2026-04-12T10:02:00Z' },
        ],
        'alice',
        '2026-04-12T10:00:30Z',
      ),
    ).toBe(1)
  })
})
