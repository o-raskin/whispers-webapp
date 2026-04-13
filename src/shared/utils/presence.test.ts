import {
  formatChatListTimestamp,
  formatPresenceLabel,
  formatTimestamp,
  isUserOnline,
  parsePresenceDate,
} from './presence'

describe('presence utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-12T12:00:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('parses ISO-like presence dates and strips a trailing Z', () => {
    const parsed = parsePresenceDate('2026-04-12T10:30:45Z')

    expect(parsed).not.toBeNull()
    expect(parsed?.getFullYear()).toBe(2026)
    expect(parsed?.getMonth()).toBe(3)
    expect(parsed?.getDate()).toBe(12)
    expect(parsed?.getHours()).toBe(10)
    expect(parsed?.getMinutes()).toBe(30)
    expect(parsed?.getSeconds()).toBe(45)
  })

  test('returns null for invalid presence dates', () => {
    expect(parsePresenceDate('not-a-date')).toBeNull()
  })

  test('detects online state from last received ping timestamps', () => {
    expect(
      isUserOnline({
        username: 'bob',
        lastPingTime: null,
        lastPingReceivedAt: Date.now() - 1_000,
      }),
    ).toBe(true)

    expect(
      isUserOnline({
        username: 'bob',
        lastPingTime: null,
        lastPingReceivedAt: Date.now() - 31_000,
      }),
    ).toBe(false)
  })

  test('falls back to lastPingTime when no ping timestamp is cached', () => {
    expect(
      isUserOnline({
        username: 'bob',
        lastPingTime: '2026-04-12T11:59:45',
      }),
    ).toBe(true)

    expect(
      isUserOnline({
        username: 'bob',
        lastPingTime: '2026-04-12T11:58:00',
      }),
    ).toBe(false)
  })

  test('formats presence labels as dd.mm.yyyy hh:mm', () => {
    expect(formatPresenceLabel('2026-04-12T08:05:00')).toBe('12.04.2026 08:05')
    expect(formatPresenceLabel('opaque-value')).toBe('opaque-value')
    expect(formatPresenceLabel(null)).toBe('n/a')
  })

  test('formats timestamps for message and chat list display', () => {
    expect(formatTimestamp('2026-04-12T08:05:00')).toMatch(/08:05/)
    expect(formatTimestamp('bad-time')).toBe('bad-time')
    expect(formatChatListTimestamp('2026-04-12T09:40:00')).toMatch(/09:40/)
    expect(formatChatListTimestamp('2026-04-10T09:40:00')).toBe('Fri')
    expect(formatChatListTimestamp('bad-time')).toBe('')
    expect(formatChatListTimestamp(null)).toBe('')
  })
})
