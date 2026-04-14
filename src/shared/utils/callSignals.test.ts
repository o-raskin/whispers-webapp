import {
  buildCallSignalText,
  CALL_SIGNAL_PREFIX,
  isCallSignalText,
  parseCallSignalText,
} from './callSignals'

describe('callSignals', () => {
  test('builds and parses a valid prefixed offer signal', () => {
    const text = buildCallSignalText({
      version: 1,
      kind: 'offer',
      chatId: 'alice__bob',
      callId: 'call-1',
      sdp: 'offer-sdp',
    })

    expect(text.startsWith(CALL_SIGNAL_PREFIX)).toBe(true)
    expect(parseCallSignalText(text)).toEqual({
      version: 1,
      kind: 'offer',
      chatId: 'alice__bob',
      callId: 'call-1',
      sdp: 'offer-sdp',
    })
  })

  test('ignores normal chat text', () => {
    expect(isCallSignalText('hello there')).toBe(false)
    expect(parseCallSignalText('hello there')).toBeNull()
  })

  test('fails safely for malformed prefixed payloads', () => {
    expect(parseCallSignalText(`${CALL_SIGNAL_PREFIX}{bad-json`)).toBeNull()
    expect(
      parseCallSignalText(
        `${CALL_SIGNAL_PREFIX}${JSON.stringify({
          version: 1,
          kind: 'ice-candidate',
          chatId: 'chat-1',
          callId: 'call-1',
          candidate: 'bad-shape',
        })}`,
      ),
    ).toBeNull()
  })
})
