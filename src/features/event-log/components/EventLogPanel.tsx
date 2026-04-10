interface EventLogPanelProps {
  lines: string[]
}

export function EventLogPanel({ lines }: EventLogPanelProps) {
  return (
    <section className="log-panel">
      <div className="log-panel-header">
        <div>
          <p className="section-kicker">Diagnostics</p>
          <h2>Event log</h2>
        </div>
        <div className="log-indicator">Live trace</div>
      </div>

      <div className="log-feed" role="log" aria-live="polite">
        {lines.length === 0 ? (
          <div className="log-empty">No events yet.</div>
        ) : (
          lines.map((line, index) => (
            <div key={`${line}-${index}`} className="log-line">
              <span className="log-bullet" aria-hidden="true" />
              <span>{line}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
