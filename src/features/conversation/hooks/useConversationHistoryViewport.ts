import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface UseConversationHistoryViewportArgs {
  messageCount: number
  showHistoryLoadingState: boolean
  threadChatId: string | null
}

export function useConversationHistoryViewport({
  messageCount,
  showHistoryLoadingState,
  threadChatId,
}: UseConversationHistoryViewportArgs) {
  const historyRef = useRef<HTMLDivElement | null>(null)
  const historyBottomRef = useRef<HTMLDivElement | null>(null)
  const previousChatIdRef = useRef<string | null>(null)
  const previousShowHistoryLoadingStateRef = useRef(showHistoryLoadingState)
  const [isHistoryAnchored, setIsHistoryAnchored] = useState(false)
  const [isHistoryAtBottom, setIsHistoryAtBottom] = useState(false)
  const isHistoryAtBottomRef = useRef(false)
  const [historyFadeState, setHistoryFadeState] = useState({
    showTopFade: false,
    showBottomFade: false,
  })

  const updateHistoryViewportState = useCallback(() => {
    const historyElement = historyRef.current

    if (!historyElement) {
      isHistoryAtBottomRef.current = false
      setIsHistoryAtBottom(false)
      setHistoryFadeState({
        showTopFade: false,
        showBottomFade: false,
      })
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = historyElement
    const maxScrollTop = Math.max(scrollHeight - clientHeight, 0)
    const threshold = 6
    const hasOverflow = maxScrollTop > threshold
    const nextIsHistoryAtBottom = !hasOverflow || scrollTop >= maxScrollTop - threshold
    const nextFadeState = {
      showTopFade: hasOverflow && scrollTop > threshold,
      showBottomFade: hasOverflow && scrollTop < maxScrollTop - threshold,
    }

    isHistoryAtBottomRef.current = nextIsHistoryAtBottom
    setIsHistoryAtBottom((current) =>
      current === nextIsHistoryAtBottom ? current : nextIsHistoryAtBottom,
    )
    setHistoryFadeState((current) =>
      current.showTopFade === nextFadeState.showTopFade &&
      current.showBottomFade === nextFadeState.showBottomFade
        ? current
        : nextFadeState,
    )
  }, [])

  const scrollHistoryToLatest = useCallback((behavior: ScrollBehavior = 'auto') => {
    const historyElement = historyRef.current
    const bottomAnchor = historyBottomRef.current

    if (!historyElement) {
      return
    }

    historyElement.scrollTo({
      top: historyElement.scrollHeight,
      behavior,
    })
    bottomAnchor?.scrollIntoView({ block: 'end', behavior })
  }, [])

  const handleHistoryBottomAnchorRef = useCallback((node: HTMLDivElement | null) => {
    historyBottomRef.current = node
  }, [])

  useLayoutEffect(() => {
    const previousChatId = previousChatIdRef.current
    const previousShowHistoryLoadingState = previousShowHistoryLoadingStateRef.current
    const didChatChange = threadChatId !== previousChatId
    const didFinishLoadingSelectedThread =
      Boolean(threadChatId) &&
      previousShowHistoryLoadingState &&
      !showHistoryLoadingState

    previousChatIdRef.current = threadChatId
    previousShowHistoryLoadingStateRef.current = showHistoryLoadingState

    if (!threadChatId) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(true)
        setIsHistoryAtBottom(true)
        isHistoryAtBottomRef.current = true
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    if (showHistoryLoadingState) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(false)
        setIsHistoryAtBottom(false)
        isHistoryAtBottomRef.current = false
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    if (didChatChange || didFinishLoadingSelectedThread) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(false)
        scrollHistoryToLatest()
        setIsHistoryAtBottom(true)
        isHistoryAtBottomRef.current = true
        window.requestAnimationFrame(() => {
          setIsHistoryAnchored(true)
          updateHistoryViewportState()
        })
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    const frameId = window.requestAnimationFrame(() => {
      updateHistoryViewportState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [scrollHistoryToLatest, showHistoryLoadingState, threadChatId, updateHistoryViewportState])

  useLayoutEffect(() => {
    if (showHistoryLoadingState || !threadChatId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      if (isHistoryAtBottomRef.current) {
        scrollHistoryToLatest()
      }
      updateHistoryViewportState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    messageCount,
    scrollHistoryToLatest,
    showHistoryLoadingState,
    threadChatId,
    updateHistoryViewportState,
  ])

  useEffect(() => {
    const historyElement = historyRef.current

    if (!historyElement) {
      return
    }

    const handleScroll = () => {
      updateHistoryViewportState()
    }

    historyElement.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateHistoryViewportState()
          })
        : null

    resizeObserver?.observe(historyElement)
    const historyContentElement = historyElement.querySelector('.history-content')

    if (historyContentElement instanceof HTMLElement) {
      resizeObserver?.observe(historyContentElement)
    }

    handleScroll()

    return () => {
      historyElement.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      resizeObserver?.disconnect()
    }
  }, [threadChatId, updateHistoryViewportState])

  return {
    handleHistoryBottomAnchorRef,
    historyFadeState,
    isHistoryAtBottom,
    historyRef,
    isHistoryAnchored,
    scrollHistoryToLatest,
    setIsHistoryAnchored,
    updateHistoryViewportState,
  }
}
