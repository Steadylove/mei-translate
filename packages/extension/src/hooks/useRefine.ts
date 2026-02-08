/**
 * Hook for translation refinement via multi-turn conversation
 * Manages conversation state and communicates with the background script
 */

import { useState, useCallback } from 'react'
import { MessageType } from '@/types/messages'

export interface RefineMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface UseRefineReturn {
  messages: RefineMessage[]
  refine: (
    instruction: string,
    context: {
      originalText: string
      currentTranslation: string
      targetLang: string
      sourceLang?: string
    }
  ) => Promise<string | null>
  isRefining: boolean
  error: string | null
  reset: () => void
}

let messageCounter = 0

function generateId(): string {
  return `refine-${Date.now()}-${++messageCounter}`
}

export function useRefine(): UseRefineReturn {
  const [messages, setMessages] = useState<RefineMessage[]>([])
  const [isRefining, setIsRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refine = useCallback(
    async (
      instruction: string,
      context: {
        originalText: string
        currentTranslation: string
        targetLang: string
        sourceLang?: string
      }
    ): Promise<string | null> => {
      setIsRefining(true)
      setError(null)

      // Add user message to conversation
      const userMessage: RefineMessage = {
        id: generateId(),
        role: 'user',
        content: instruction,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMessage])

      try {
        // Build history from existing messages (limit to last 20 messages = 10 rounds)
        const currentMessages = [...messages, userMessage]
        const history = currentMessages.slice(-20).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }))

        // Remove the last user message from history since it's sent as 'instruction'
        history.pop()

        const response = await chrome.runtime.sendMessage({
          type: MessageType.REFINE_TRANSLATE,
          args: {
            originalText: context.originalText,
            currentTranslation: context.currentTranslation,
            instruction,
            history,
            targetLang: context.targetLang,
            sourceLang: context.sourceLang,
          },
        })

        if (response?.error) {
          throw new Error(response.error)
        }

        const refinedText = response?.refinedText || response?.data?.refinedText
        if (!refinedText) {
          throw new Error('No refined text returned')
        }

        // Add assistant response to conversation
        const assistantMessage: RefineMessage = {
          id: generateId(),
          role: 'assistant',
          content: refinedText,
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMessage])

        return refinedText
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Refinement failed'
        setError(errorMessage)

        // Remove the user message on error
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id))

        return null
      } finally {
        setIsRefining(false)
      }
    },
    [messages]
  )

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
    setIsRefining(false)
  }, [])

  return {
    messages,
    refine,
    isRefining,
    error,
    reset,
  }
}
