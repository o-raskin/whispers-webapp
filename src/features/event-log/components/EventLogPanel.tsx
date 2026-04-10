interface EventLogPanelProps {
  lines: string[]
}

export function EventLogPanel({ lines }: EventLogPanelProps) {
  return (
    <section className="log-panel">
      <h2>Event log</h2>
      <textarea value={lines.join('\n')} readOnly />
    </section>
  )
}
