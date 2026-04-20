export function getInitials(value: string) {
  return value.slice(0, 2).toUpperCase()
}

export function getChatDisplayName(chat: {
  username: string
  firstName?: string | null
  lastName?: string | null
}) {
  const fullName = [chat.firstName?.trim(), chat.lastName?.trim()].filter(Boolean).join(' ')

  return fullName || chat.username
}
