/**
 * Hook for translation functionality
 */

import { useState, useCallback } from 'react'
import { MessageType } from '@/types/messages'

export interface TranslationResult {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
}

export interface UseTranslateReturn {
  translate: (text: string, targetLanguage?: string) => Promise<TranslationResult | null>
  detectLanguage: (text: string) => Promise<string>
  isLoading: boolean
  error: string | null
  result: TranslationResult | null
}

export function useTranslate(): UseTranslateReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranslationResult | null>(null)

  const detectLanguage = useCallback(async (text: string): Promise<string> => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.DETECT_LANG,
        args: { text },
      })
      return response?.language || 'en'
    } catch {
      // Fallback to simple detection
      const chineseRegex = /[\u4e00-\u9fa5]/g
      const matches = text.match(chineseRegex)
      return matches && matches.length > text.length * 0.3 ? 'zh' : 'en'
    }
  }, [])

  const translate = useCallback(
    async (text: string, targetLanguage?: string): Promise<TranslationResult | null> => {
      setIsLoading(true)
      setError(null)

      try {
        // Detect source language if target not specified
        const sourceLang = await detectLanguage(text)
        const target = targetLanguage || (sourceLang === 'zh' ? 'en' : 'zh')

        const response = await chrome.runtime.sendMessage({
          type: MessageType.TRANSLATE,
          args: { text, targetLanguage: target },
        })

        if (response?.error) {
          throw new Error(response.error)
        }

        const translationResult: TranslationResult = {
          translatedText: response.translatedText,
          sourceLanguage: response.sourceLanguage,
          targetLanguage: response.targetLanguage,
        }

        setResult(translationResult)
        return translationResult
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Translation failed'
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [detectLanguage]
  )

  return {
    translate,
    detectLanguage,
    isLoading,
    error,
    result,
  }
}
