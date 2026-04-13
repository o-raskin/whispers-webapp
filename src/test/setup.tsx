import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React, { forwardRef } from 'react'
import { afterEach, vi } from 'vitest'

function createStorage() {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

const localStorageMock = createStorage()

afterEach(() => {
  cleanup()
  localStorageMock.clear()
  vi.restoreAllMocks()
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const visualViewportMock = {
  width: 390,
  height: 844,
  offsetTop: 0,
  offsetLeft: 0,
  pageTop: 0,
  pageLeft: 0,
  scale: 1,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  value: ResizeObserverMock,
})

Object.defineProperty(window, 'visualViewport', {
  writable: true,
  value: visualViewportMock,
})

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: localStorageMock,
})

Object.defineProperty(globalThis, 'localStorage', {
  writable: true,
  value: localStorageMock,
})

Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(window, 'requestAnimationFrame', {
  writable: true,
  value: vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)),
})

Object.defineProperty(window, 'cancelAnimationFrame', {
  writable: true,
  value: vi.fn((handle: number) => window.clearTimeout(handle)),
})

vi.mock('framer-motion', async () => {
  const componentCache = new Map<string, React.ForwardRefExoticComponent<Record<string, unknown>>>()

  const filterMotionProps = (props: Record<string, unknown>) => {
    const {
      animate,
      exit,
      initial,
      layout,
      layoutId,
      transition,
      variants,
      whileHover,
      whileTap,
      whileInView,
      onAnimationComplete,
      ...domProps
    } = props

    void animate
    void exit
    void initial
    void layout
    void layoutId
    void transition
    void variants
    void whileHover
    void whileTap
    void whileInView

    return {
      domProps,
      onAnimationComplete:
        typeof onAnimationComplete === 'function' ? onAnimationComplete : undefined,
    }
  }

  const motion = new Proxy(
    {},
    {
      get: (_, tag: string) => {
        if (!componentCache.has(tag)) {
          componentCache.set(
            tag,
            forwardRef<HTMLElement, Record<string, unknown>>(function MotionPrimitive(
              props,
              ref,
            ) {
              const { children, ...rest } = props
              const { domProps } = filterMotionProps(rest)

              return React.createElement(
                tag,
                { ...domProps, ref },
                children as React.ReactNode,
              )
            }),
          )
        }

        return componentCache.get(tag)!
      },
    },
  )

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    MotionConfig: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  }
})
