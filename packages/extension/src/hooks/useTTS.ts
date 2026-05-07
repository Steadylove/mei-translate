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

const PREFERRED_VOICES: Record<string, string[]> = {
  zh: [
    'tingting',
    'mei-jia',
    'meijia',
    'sin-ji',
    'xiaoxiao',
    'huihui',
    'yaoyao',
    'google 普通话',
    'google 國語',
    'google mandarin',
    'google chinese',
  ],
  en: ['samantha', 'daniel', 'alex', 'google us english', 'google uk english', 'microsoft aria'],
  ja: ['kyoko', 'otoya', 'nanami', 'google 日本語', 'google japanese'],
  ko: ['yuna', 'google 한국의', 'google korean'],
  fr: ['amelie', 'thomas', 'google français', 'google french'],
  de: ['anna', 'google deutsch', 'google german'],
  es: ['monica', 'jorge', 'paulina', 'google español', 'google spanish'],
}

function normalizeLang(lang: string): string {
  if (!lang || lang === 'auto' || lang === 'detect') return 'en-US'
  return LANG_MAP[lang] || lang
}

function getLangBase(lang: string): string {
  return normalizeLang(lang).split('-')[0].toLowerCase()
}

function getDefaultProsody(lang: string): Required<Pick<TTSOptions, 'rate' | 'pitch' | 'volume'>> {
  const baseLang = getLangBase(lang)

  if (baseLang === 'zh') {
    return { rate: 0.88, pitch: 0.95, volume: 1 }
  }

  if (baseLang === 'ja' || baseLang === 'ko') {
    return { rate: 0.9, pitch: 0.98, volume: 1 }
  }

  return { rate: 0.92, pitch: 1, volume: 1 }
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
      if (voices.length === 0) return null

      const targetLang = normalizeLang(lang).toLowerCase()
      const baseLang = targetLang.split('-')[0]
      const preferredNames = PREFERRED_VOICES[baseLang] || []

      const candidates = voices
        .map((voice) => {
          const voiceLang = voice.lang.toLowerCase()
          const voiceName = voice.name.toLowerCase()
          let score = 0

          if (voiceLang === targetLang) score += 100
          else if (voiceLang.startsWith(`${baseLang}-`)) score += 80
          else if (voiceLang.startsWith(baseLang)) score += 60
          else return { voice, score: -1 }

          if (voice.localService) score += 25

          const preferredIndex = preferredNames.findIndex((name) => voiceName.includes(name))
          if (preferredIndex >= 0) {
            score += 60 - preferredIndex
          }

          if (voiceName.includes('premium') || voiceName.includes('enhanced')) score += 10
          if (voiceName.includes('compact')) score -= 20

          return { voice, score }
        })
        .filter((candidate) => candidate.score >= 0)
        .sort((a, b) => b.score - a.score)

      return candidates[0]?.voice || null
    },
    [isSupported]
  )

  // Speak text
  const speak = useCallback(
    (text: string, options: TTSOptions = {}) => {
      if (!isSupported || !text.trim()) return

      // Stop any current speech
      stop()

      const { lang = 'en' } = options
      const defaultProsody = getDefaultProsody(lang)
      const rate = options.rate ?? defaultProsody.rate
      const pitch = options.pitch ?? defaultProsody.pitch
      const volume = options.volume ?? defaultProsody.volume

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = normalizeLang(lang)
      utterance.rate = Math.max(0.5, Math.min(1.5, rate))
      utterance.pitch = Math.max(0.7, Math.min(1.3, pitch))
      utterance.volume = Math.max(0, Math.min(1, volume))

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

      const speakWithBestVoice = () => {
        const voice = getBestVoice(lang)
        if (voice) {
          utterance.voice = voice
        }
        window.speechSynthesis.speak(utterance)
      }

      // Some browsers load voices asynchronously; wait briefly to avoid the default robotic voice.
      if (window.speechSynthesis.getVoices().length === 0) {
        setTimeout(speakWithBestVoice, 120)
      } else {
        speakWithBestVoice()
      }
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
