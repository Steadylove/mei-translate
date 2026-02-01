/**
 * Web Page Translation Toolbar Component
 * Provides controls for translating entire web pages
 */

import { useState, useCallback } from 'react'
import {
  startWebTranslation,
  stopWebTranslation,
  setDisplayMode,
  DisplayMode,
  setTargetLanguage as setWebTransTargetLang,
} from '@/lib/webpage-translation'
import Storage from '@/services/storage'

interface WebTransToolbarProps {
  action: string
  targetLanguage: string
  onTargetLanguageChange: (lang: string) => void
  onClose: () => void
}

type TranslationState = 'idle' | 'translating' | 'translated'

const LANGUAGES = [
  { value: 'zh', label: '🇨🇳 Chinese' },
  { value: 'en', label: '🇺🇸 English' },
  { value: 'ja', label: '🇯🇵 Japanese' },
  { value: 'ko', label: '🇰🇷 Korean' },
  { value: 'fr', label: '🇫🇷 French' },
  { value: 'de', label: '🇩🇪 German' },
  { value: 'es', label: '🇪🇸 Spanish' },
  { value: 'ru', label: '🇷🇺 Russian' },
]

const WebTransToolbar: React.FC<WebTransToolbarProps> = ({
  targetLanguage,
  onTargetLanguageChange,
  onClose,
}) => {
  const [state, setState] = useState<TranslationState>('idle')
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(DisplayMode.COMPARISON)

  const handleTranslate = useCallback(async () => {
    setState('translating')
    setWebTransTargetLang(targetLanguage)

    try {
      await startWebTranslation()
      setState('translated')
    } catch (err) {
      console.error('Translation failed:', err)
      setState('idle')
    }
  }, [targetLanguage])

  const handleShowOriginal = useCallback(() => {
    setDisplayMode(DisplayMode.ORIGIN)
    setDisplayModeState(DisplayMode.ORIGIN)
  }, [])

  const handleShowTranslation = useCallback(() => {
    setDisplayMode(DisplayMode.TRANSLATE)
    setDisplayModeState(DisplayMode.TRANSLATE)
  }, [])

  const handleShowBoth = useCallback(() => {
    setDisplayMode(DisplayMode.COMPARISON)
    setDisplayModeState(DisplayMode.COMPARISON)
  }, [])

  const handleStop = useCallback(() => {
    stopWebTranslation()
    setState('idle')
  }, [])

  const handleLanguageChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newLang = e.target.value
      onTargetLanguageChange(newLang)
      await Storage.set('targetLanguage', newLang)

      if (state === 'translated') {
        handleStop()
        setState('translating')
        setWebTransTargetLang(newLang)
        await startWebTranslation()
        setState('translated')
      }
    },
    [onTargetLanguageChange, state, handleStop]
  )

  return (
    <div className="webtrans-toolbar">
      {/* Language selector */}
      <select value={targetLanguage} onChange={handleLanguageChange}>
        {LANGUAGES.map((lang) => (
          <option key={lang.value} value={lang.value}>
            {lang.label}
          </option>
        ))}
      </select>

      <div className="toolbar-divider" />

      {/* Action buttons based on state */}
      {state === 'idle' && (
        <button className="btn-primary" onClick={handleTranslate}>
          ✨ Translate Page
        </button>
      )}

      {state === 'translating' && (
        <button className="btn-secondary" disabled>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid #e2e8f0',
                borderTopColor: '#8b5cf6',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            Translating...
          </span>
        </button>
      )}

      {state === 'translated' && (
        <>
          <button
            className={displayMode === DisplayMode.ORIGIN ? 'btn-primary' : 'btn-secondary'}
            onClick={handleShowOriginal}
          >
            Original
          </button>
          <button
            className={displayMode === DisplayMode.TRANSLATE ? 'btn-primary' : 'btn-secondary'}
            onClick={handleShowTranslation}
          >
            Translation
          </button>
          <button
            className={displayMode === DisplayMode.COMPARISON ? 'btn-primary' : 'btn-secondary'}
            onClick={handleShowBoth}
          >
            Both
          </button>
          <div className="toolbar-divider" />
          <button className="btn-secondary" onClick={handleStop}>
            Reset
          </button>
        </>
      )}

      {/* Close button */}
      <button className="btn-close" onClick={onClose} title="Close">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default WebTransToolbar
