import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EventLogPanel } from './EventLogPanel'

describe('EventLogPanel', () => {
  test('shows the latest line in the summary and expands the full log', async () => {
    const user = userEvent.setup()

    render(<EventLogPanel lines={['[12:00:00] Latest', '[11:59:00] Earlier']} />)

    expect(screen.getByText('[12:00:00] Latest')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show' }))

    expect(screen.getByRole('log')).toBeInTheDocument()
    expect(screen.getAllByText(/\[(12:00:00|11:59:00)\]/)).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Hide' }))

    expect(screen.queryByRole('log')).not.toBeInTheDocument()
  })

  test('shows an empty message when the log is expanded without lines', async () => {
    const user = userEvent.setup()

    render(<EventLogPanel lines={[]} />)

    await user.click(screen.getByRole('button', { name: 'Show' }))

    expect(screen.getAllByText('No events yet.')).toHaveLength(2)
  })
})
