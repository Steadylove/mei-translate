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

export interface DualTranslationResult {
  machine: {
    translatedText: string | null
    provider: string | null
    error?: string
  }
  llm: {
    translatedText: string | null
    model: string | null
    error?: string
    available: boolean
  }
  sourceLanguage: string
  targetLanguage: string
}

export interface UseTranslateReturn {
  translate: (text: string, targetLanguage?: string) => Promise<TranslationResult | null>
  dualTranslate: (text: string, targetLanguage?: string) => Promise<DualTranslationResult | null>
  detectLanguage: (text: string) => Promise<string>
  isLoading: boolean
  isMachineLoading: boolean
  isLLMLoading: boolean
  error: string | null
  result: TranslationResult | null
  dualResult: DualTranslationResult | null
}

export function useTranslate(): UseTranslateReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isMachineLoading, setIsMachineLoading] = useState(false)
  const [isLLMLoading, setIsLLMLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [dualResult, setDualResult] = useState<DualTranslationResult | null>(null)

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

  const dualTranslate = useCallback(
    async (text: string, targetLanguage?: string): Promise<DualTranslationResult | null> => {
      console.log('[MeiTrans] dualTranslate called, text length:', text.length)
      setIsLoading(true)
      setIsMachineLoading(true)
      setIsLLMLoading(true)
      setError(null)
      setDualResult(null)

      try {
        // Detect source language if target not specified
        const sourceLang = await detectLanguage(text)
        const target = targetLanguage || (sourceLang === 'zh' ? 'en' : 'zh')

        console.log('[MeiTrans] Sending message to background, target:', target)
        const response = await chrome.runtime.sendMessage({
          type: MessageType.TRANSLATE,
          args: { text, targetLanguage: target, dual: true },
        })
        console.log('[MeiTrans] Background response:', response)

        if (response?.error) {
          throw new Error(response.error)
        }

        // If response has dual format
        if (response.machine !== undefined) {
          const dualTranslationResult: DualTranslationResult = {
            machine: response.machine,
            llm: response.llm,
            sourceLanguage: response.sourceLanguage || sourceLang,
            targetLanguage: response.targetLanguage || target,
          }

          setDualResult(dualTranslationResult)
          setIsMachineLoading(false)
          setIsLLMLoading(!response.llm?.available)

          return dualTranslationResult
        }

        // Fallback: convert single result to dual format
        const dualTranslationResult: DualTranslationResult = {
          machine: {
            translatedText: response.translatedText,
            provider: 'backend',
          },
          llm: {
            translatedText: null,
            model: null,
            available: false,
          },
          sourceLanguage: response.sourceLanguage || sourceLang,
          targetLanguage: response.targetLanguage || target,
        }

        setDualResult(dualTranslationResult)
        return dualTranslationResult
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Translation failed'
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
        setIsMachineLoading(false)
        setIsLLMLoading(false)
      }
    },
    [detectLanguage]
  )

  return {
    translate,
    dualTranslate,
    detectLanguage,
    isLoading,
    isMachineLoading,
    isLLMLoading,
    error,
    result,
    dualResult,
  }
}
