import { createRoot } from 'react-dom/client'
import type { ReactNode } from 'react'

const mainMocks = vi.hoisted(() => ({
  renderMock: vi.fn(),
}))

vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({
    render: mainMocks.renderMock,
  })),
}))

vi.mock('./app/App.tsx', () => ({
  App: () => <div>App body</div>,
}))

vi.mock('./app/providers/AppProviders.tsx', () => ({
  AppProviders: ({ children }: { children: ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}))

describe('main entrypoint', () => {
  test('mounts the app into the root element', async () => {
    vi.resetModules()
    document.body.innerHTML = '<div id="root"></div>'

    await import('./main')

    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'))
    expect(mainMocks.renderMock).toHaveBeenCalledTimes(1)
  })
})
