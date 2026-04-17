import { useCallback, useEffect, useState } from 'react'
import type { PointerEvent } from 'react'

const MOBILE_LAYOUT_MEDIA_QUERY = '(max-width: 760px)'

function getInitialMobileLayout() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches
}

export function useResponsiveAppShell() {
  const [isMobileLayout, setIsMobileLayout] = useState(getInitialMobileLayout)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileLayout(event.matches)
    }

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

  const handleShellPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top

    event.currentTarget.style.setProperty('--spotlight-x', `${x}px`)
    event.currentTarget.style.setProperty('--spotlight-y', `${y}px`)
  }, [])

  const handleShellPointerLeave = useCallback((event: PointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty('--spotlight-x', '50%')
    event.currentTarget.style.setProperty('--spotlight-y', '18%')
  }, [])

  return {
    handleShellPointerLeave,
    handleShellPointerMove,
    isMobileLayout,
  }
}
