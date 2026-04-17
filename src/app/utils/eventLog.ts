export function appendLog(lines: string[], message: string) {
  const timestamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return [`[${timestamp}] ${message}`, ...lines]
}
