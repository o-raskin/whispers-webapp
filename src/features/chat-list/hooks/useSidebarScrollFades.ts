import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

interface UseSidebarScrollFadesArgs {
  chatsLength: number
  isInfoOpen: boolean
  status: string
}

export function useSidebarScrollFades({
  chatsLength,
  isInfoOpen,
  status,
}: UseSidebarScrollFadesArgs) {
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null)
  const [sidebarFadeState, setSidebarFadeState] = useState({
    showTopFade: false,
    showBottomFade: false,
  })

  const updateSidebarFadeState = useCallback(() => {
    const sidebarScrollElement = sidebarScrollRef.current

    if (!sidebarScrollElement) {
      setSidebarFadeState({
        showTopFade: false,
        showBottomFade: false,
      })
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = sidebarScrollElement
    const maxScrollTop = Math.max(scrollHeight - clientHeight, 0)
    const threshold = 6
    const hasOverflow = maxScrollTop > threshold

    setSidebarFadeState({
      showTopFade: hasOverflow && scrollTop > threshold,
      showBottomFade: hasOverflow && scrollTop < maxScrollTop - threshold,
    })
  }, [])

  useLayoutEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      updateSidebarFadeState()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [chatsLength, isInfoOpen, status, updateSidebarFadeState])

  useEffect(() => {
    window.addEventListener('resize', updateSidebarFadeState)

    return () => {
      window.removeEventListener('resize', updateSidebarFadeState)
    }
  }, [updateSidebarFadeState])

  return {
    sidebarFadeState,
    sidebarScrollRef,
    updateSidebarFadeState,
  }
}
