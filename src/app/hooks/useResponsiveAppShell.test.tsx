import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useResponsiveAppShell } from './useResponsiveAppShell'

interface MatchMediaController {
  mediaQueryList: MediaQueryList
  setMatches: (matches: boolean) => void
}

function createMatchMediaController(initialMatches: boolean): MatchMediaController {
  const listeners = new Set<EventListenerOrEventListenerObject>()
  let currentMatches = initialMatches
  const mediaQueryList = {
    get matches() {
      return currentMatches
    },
    media: '(max-width: 760px)',
    onchange: null,
    addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
      if (event === 'change') {
        listeners.add(listener)
      }
    }),
    removeEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
      if (event === 'change') {
        listeners.delete(listener)
      }
    }),
    addListener: vi.fn((listener: EventListenerOrEventListenerObject) => {
      listeners.add(listener)
    }),
    removeListener: vi.fn((listener: EventListenerOrEventListenerObject) => {
      listeners.delete(listener)
    }),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList

  return {
    mediaQueryList,
    setMatches(nextMatches: boolean) {
      currentMatches = nextMatches
      const event = {
        matches: nextMatches,
        media: mediaQueryList.media,
      } as MediaQueryListEvent

      for (const listener of listeners) {
        if (typeof listener === 'function') {
          listener(event)
        } else {
          listener.handleEvent(event)
        }
      }

      mediaQueryList.onchange?.call(mediaQueryList, event)
    },
  }
}

function ResponsiveAppShellHarness() {
  const {
    handleShellPointerLeave,
    handleShellPointerMove,
    isMobileLayout,
  } = useResponsiveAppShell()

  return (
    <section
      className="app-shell"
      data-testid="responsive-shell"
      data-layout={isMobileLayout ? 'mobile' : 'desktop'}
      onPointerLeave={handleShellPointerLeave}
      onPointerMove={handleShellPointerMove}
    />
  )
}

describe('useResponsiveAppShell', () => {
  test('updates shell spotlight coordinates from pointer movement', () => {
    render(<ResponsiveAppShellHarness />)

    const shell = screen.getByTestId('responsive-shell')

    Object.defineProperty(shell, 'getBoundingClientRect', {
      value: () => ({
        left: 10,
        top: 20,
        right: 210,
        bottom: 220,
        width: 200,
        height: 200,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      }),
    })

    fireEvent.pointerMove(shell, { clientX: 60, clientY: 80 })
    expect(shell).toHaveStyle({
      '--spotlight-x': '50px',
      '--spotlight-y': '60px',
    })

    fireEvent.pointerLeave(shell)
    expect(shell).toHaveStyle({
      '--spotlight-x': '50%',
      '--spotlight-y': '18%',
    })
  })

  test('syncs the app height to the visible viewport on mobile browsers', async () => {
    render(<ResponsiveAppShellHarness />)

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--app-visible-height')).toBe(
        '844px',
      )
      expect(document.documentElement.style.getPropertyValue('--app-visible-offset-top')).toBe(
        '0px',
      )
    })
  })

  test('tracks mobile layout changes from matchMedia', () => {
    const matchMediaController = createMatchMediaController(false)

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => matchMediaController.mediaQueryList),
    })

    render(<ResponsiveAppShellHarness />)

    expect(screen.getByTestId('responsive-shell')).toHaveAttribute('data-layout', 'desktop')

    act(() => {
      matchMediaController.setMatches(true)
    })

    expect(screen.getByTestId('responsive-shell')).toHaveAttribute('data-layout', 'mobile')
  })
})
