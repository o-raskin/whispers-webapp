import { act, render, screen } from '@testing-library/react'
import { waitFor } from '@testing-library/react'
import { useConversationHistoryViewport } from './useConversationHistoryViewport'

interface HistoryViewportHarnessProps {
  messageCount: number
  showHistoryLoadingState?: boolean
  threadChatId: string | null
}

function HistoryViewportHarness({
  messageCount,
  showHistoryLoadingState = false,
  threadChatId,
}: HistoryViewportHarnessProps) {
  const {
    handleHistoryBottomAnchorRef,
    historyFadeState,
    isHistoryAtBottom,
    historyRef,
    isHistoryAnchored,
  } = useConversationHistoryViewport({
    messageCount,
    showHistoryLoadingState,
    threadChatId,
  })

  return (
    <div>
      <div data-testid="history" ref={historyRef}>
        <div className="history-content">
          <div ref={handleHistoryBottomAnchorRef} />
        </div>
      </div>
      <div data-testid="anchored">{String(isHistoryAnchored)}</div>
      <div data-testid="at-bottom">{String(isHistoryAtBottom)}</div>
      <div data-testid="top-fade">{String(historyFadeState.showTopFade)}</div>
      <div data-testid="bottom-fade">{String(historyFadeState.showBottomFade)}</div>
    </div>
  )
}

function setScrollMetrics(
  element: HTMLElement,
  {
    clientHeight,
    scrollHeight,
    scrollTop,
  }: { clientHeight: number; scrollHeight: number; scrollTop: number },
) {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  })
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    writable: true,
    value: scrollTop,
  })
}

describe('useConversationHistoryViewport', () => {
  test('keeps manual scroll position and shows both edge fades away from the bottom', () => {
    const { rerender } = render(
      <HistoryViewportHarness
        messageCount={3}
        threadChatId="chat-1"
      />,
    )
    const historyElement = screen.getByTestId('history') as HTMLDivElement
    const scrollToSpy = vi.fn()
    const scrollIntoViewSpy = vi.fn()

    historyElement.scrollTo = scrollToSpy
    Element.prototype.scrollIntoView = scrollIntoViewSpy

    setScrollMetrics(historyElement, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 50,
    })

    act(() => {
      historyElement.dispatchEvent(new Event('scroll'))
    })

    expect(screen.getByTestId('at-bottom')).toHaveTextContent('false')
    expect(screen.getByTestId('top-fade')).toHaveTextContent('true')
    expect(screen.getByTestId('bottom-fade')).toHaveTextContent('true')

    scrollToSpy.mockClear()
    scrollIntoViewSpy.mockClear()

    rerender(
      <HistoryViewportHarness
        messageCount={4}
        threadChatId="chat-1"
      />,
    )

    expect(scrollToSpy).not.toHaveBeenCalled()
    expect(scrollIntoViewSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('at-bottom')).toHaveTextContent('false')
    expect(screen.getByTestId('top-fade')).toHaveTextContent('true')
    expect(screen.getByTestId('bottom-fade')).toHaveTextContent('true')
  })

  test('shows only the bottom fade when the viewer is at the top of an overflowing thread', () => {
    render(
      <HistoryViewportHarness
        messageCount={3}
        threadChatId="chat-1"
      />,
    )
    const historyElement = screen.getByTestId('history') as HTMLDivElement

    historyElement.scrollTo = vi.fn()
    Element.prototype.scrollIntoView = vi.fn()

    setScrollMetrics(historyElement, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 0,
    })

    act(() => {
      historyElement.dispatchEvent(new Event('scroll'))
    })

    expect(screen.getByTestId('at-bottom')).toHaveTextContent('false')
    expect(screen.getByTestId('top-fade')).toHaveTextContent('false')
    expect(screen.getByTestId('bottom-fade')).toHaveTextContent('true')
  })

  test('re-anchors the selected thread after loading finishes for the same chat', async () => {
    const { rerender } = render(
      <HistoryViewportHarness
        messageCount={0}
        showHistoryLoadingState={true}
        threadChatId="private-chat-1"
      />,
    )
    const historyElement = screen.getByTestId('history') as HTMLDivElement
    const scrollToSpy = vi.fn()
    const scrollIntoViewSpy = vi.fn()

    historyElement.scrollTo = scrollToSpy
    Element.prototype.scrollIntoView = scrollIntoViewSpy

    setScrollMetrics(historyElement, {
      clientHeight: 100,
      scrollHeight: 300,
      scrollTop: 0,
    })

    rerender(
      <HistoryViewportHarness
        messageCount={2}
        showHistoryLoadingState={false}
        threadChatId="private-chat-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('anchored')).toHaveTextContent('true')
      expect(scrollToSpy).toHaveBeenCalled()
    })
  })
})
