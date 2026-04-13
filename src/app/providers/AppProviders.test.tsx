import { render, screen } from '@testing-library/react'
import { AppProviders } from './AppProviders'

test('renders children unchanged', () => {
  render(
    <AppProviders>
      <div>Child content</div>
    </AppProviders>,
  )

  expect(screen.getByText('Child content')).toBeInTheDocument()
})
