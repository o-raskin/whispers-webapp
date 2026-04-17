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
  const [isHistoryAnchored, setIsHistoryAnchored] = useState(false)
  const [historyFadeState, setHistoryFadeState] = useState({
    showTopFade: false,
    showBottomFade: false,
  })

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

  const updateHistoryFadeState = useCallback(() => {
    const historyElement = historyRef.current

    if (!historyElement) {
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

    setHistoryFadeState({
      showTopFade: hasOverflow && scrollTop > threshold,
      showBottomFade: hasOverflow && scrollTop < maxScrollTop - threshold,
    })
  }, [])

  const handleHistoryBottomAnchorRef = useCallback((node: HTMLDivElement | null) => {
    historyBottomRef.current = node
  }, [])

  useLayoutEffect(() => {
    const previousChatId = previousChatIdRef.current
    const didChatChange = threadChatId !== previousChatId

    previousChatIdRef.current = threadChatId

    if (!threadChatId) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(true)
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    if (showHistoryLoadingState) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(false)
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    if (didChatChange) {
      const frameId = window.requestAnimationFrame(() => {
        setIsHistoryAnchored(false)
        scrollHistoryToLatest()
        updateHistoryFadeState()
      })

      return () => {
        window.cancelAnimationFrame(frameId)
      }
    }

    const frameId = window.requestAnimationFrame(() => {
      setIsHistoryAnchored(true)
      updateHistoryFadeState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [scrollHistoryToLatest, showHistoryLoadingState, threadChatId, updateHistoryFadeState])

  useLayoutEffect(() => {
    if (showHistoryLoadingState || !threadChatId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollHistoryToLatest()
      setIsHistoryAnchored(true)
      updateHistoryFadeState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [
    messageCount,
    scrollHistoryToLatest,
    showHistoryLoadingState,
    threadChatId,
    updateHistoryFadeState,
  ])

  useEffect(() => {
    const historyElement = historyRef.current

    if (!historyElement) {
      return
    }

    const handleScroll = () => {
      updateHistoryFadeState()
    }

    historyElement.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            updateHistoryFadeState()
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
  }, [threadChatId, updateHistoryFadeState])

  return {
    handleHistoryBottomAnchorRef,
    historyFadeState,
    historyRef,
    isHistoryAnchored,
    scrollHistoryToLatest,
    setIsHistoryAnchored,
  }
}
