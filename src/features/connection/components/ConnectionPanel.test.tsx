import { render, screen } from '@testing-library/react'
import { ConnectionPanel } from './ConnectionPanel'

test('renders the topbar brand copy', () => {
  render(<ConnectionPanel />)

  expect(screen.getByText('Premium realtime messaging')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Whispers' })).toBeInTheDocument()
})
