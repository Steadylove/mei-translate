/**
 * TTS (Text-to-Speech) Hook
 * Uses Web Speech API for free, browser-native text-to-speech
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// Language code mapping for better voice matching
const LANG_MAP: Record<string, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
  ko: 'ko-KR',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  ru: 'ru-RU',
  pt: 'pt-BR',
  it: 'it-IT',
  ar: 'ar-SA',
  hi: 'hi-IN',
  th: 'th-TH',
  vi: 'vi-VN',
}

export interface TTSOptions {
  lang?: string
  rate?: number // 0.1 - 10, default 1
  pitch?: number // 0 - 2, default 1
  volume?: number // 0 - 1, default 1
}

export interface UseTTSReturn {
  speak: (text: string, options?: TTSOptions) => void
  stop: () => void
  isSpeaking: boolean
  isSupported: boolean
}

export function useTTS(): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  // Check if Web Speech API is supported
  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Stop current speech
  const stop = useCallback(() => {
    if (isSupported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [isSupported])

  // Get best voice for language
  const getBestVoice = useCallback(
    (lang: string): SpeechSynthesisVoice | null => {
      if (!isSupported) return null

      const voices = window.speechSynthesis.getVoices()
      const targetLang = LANG_MAP[lang] || lang

      // Try to find exact match first
      let voice = voices.find((v) => v.lang === targetLang || v.lang.startsWith(lang + '-'))

      // Fallback to any voice that starts with the language code
      if (!voice) {
        voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()))
      }

      // Prefer native/local voices over network voices for better quality
      const nativeVoices = voices.filter(
        (v) => !v.localService === false && (v.lang === targetLang || v.lang.startsWith(lang + '-'))
      )
      if (nativeVoices.length > 0) {
        voice = nativeVoices[0]
      }

      return voice || null
    },
    [isSupported]
  )

  // Speak text
  const speak = useCallback(
    (text: string, options: TTSOptions = {}) => {
      if (!isSupported || !text.trim()) return

      // Stop any current speech
      stop()

      const { lang = 'en', rate = 1, pitch = 1, volume = 1 } = options

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = LANG_MAP[lang] || lang
      utterance.rate = Math.max(0.1, Math.min(10, rate))
      utterance.pitch = Math.max(0, Math.min(2, pitch))
      utterance.volume = Math.max(0, Math.min(1, volume))

      // Try to set a good voice
      const voice = getBestVoice(lang)
      if (voice) {
        utterance.voice = voice
      }

      utterance.onstart = () => {
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
      }

      utterance.onerror = (event) => {
        console.error('[TTS] Error:', event.error)
        setIsSpeaking(false)
      }

      utteranceRef.current = utterance

      // Small delay to ensure voices are loaded
      setTimeout(() => {
        window.speechSynthesis.speak(utterance)
      }, 50)
    },
    [isSupported, stop, getBestVoice]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }
    }
  }, [isSupported])

  // Load voices (needed for some browsers)
  useEffect(() => {
    if (!isSupported) return

    // Voices might not be loaded immediately
    const loadVoices = () => {
      window.speechSynthesis.getVoices()
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [isSupported])

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
  }
}

export default useTTS
