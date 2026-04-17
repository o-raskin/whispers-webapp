import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

interface UseConversationComposerArgs {
  messageDraft: string
  onMessageDraftChange: (value: string) => void
  onSendMessage: () => void
  threadChatId: string | null
}

export function useConversationComposer({
  messageDraft,
  onMessageDraftChange,
  onSendMessage,
  threadChatId,
}: UseConversationComposerArgs) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [isComposerFocused, setIsComposerFocused] = useState(false)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsEmojiPickerOpen(false)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [threadChatId])

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onMessageDraftChange(event.target.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSendMessage()
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    const textarea = textareaRef.current

    if (!textarea) {
      onMessageDraftChange(`${messageDraft}${emoji}`)
      setIsEmojiPickerOpen(false)
      return
    }

    const selectionStart = textarea.selectionStart ?? messageDraft.length
    const selectionEnd = textarea.selectionEnd ?? messageDraft.length
    const nextValue =
      `${messageDraft.slice(0, selectionStart)}${emoji}${messageDraft.slice(selectionEnd)}`

    onMessageDraftChange(nextValue)
    setIsEmojiPickerOpen(false)

    window.requestAnimationFrame(() => {
      textarea.focus()
      const caretPosition = selectionStart + emoji.length
      textarea.setSelectionRange(caretPosition, caretPosition)
    })
  }

  const toggleEmojiPicker = () => {
    setIsEmojiPickerOpen((current) => !current)

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }

  return {
    closeEmojiPicker: () => {
      setIsEmojiPickerOpen(false)
    },
    handleChange,
    handleEmojiSelect,
    handleKeyDown,
    isComposerFocused,
    isEmojiPickerOpen,
    setIsComposerFocused,
    textareaRef,
    toggleEmojiPicker,
  }
}
