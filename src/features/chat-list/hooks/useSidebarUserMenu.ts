import { useEffect, useRef, useState } from 'react'

interface UseSidebarUserMenuArgs {
  currentUserLabel: string
  status: string
}

export function useSidebarUserMenu({
  currentUserLabel,
  status,
}: UseSidebarUserMenuArgs) {
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [activeUserMenuScope, setActiveUserMenuScope] = useState<string | null>(null)
  const userMenuScope = `${currentUserLabel}:${status}`
  const isUserMenuOpen = activeUserMenuScope === userMenuScope

  useEffect(() => {
    if (!isUserMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (userMenuRef.current?.contains(target)) {
        return
      }

      setActiveUserMenuScope(null)
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isUserMenuOpen])

  useEffect(() => {
    if (!isUserMenuOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveUserMenuScope(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isUserMenuOpen])

  return {
    closeUserMenu: () => {
      setActiveUserMenuScope(null)
    },
    isUserMenuOpen,
    toggleUserMenu: () => {
      setActiveUserMenuScope((current) => (current === userMenuScope ? null : userMenuScope))
    },
    userMenuRef,
  }
}
