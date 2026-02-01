/**
 * Selection Translation Component
 * Shows a translate button on text selection, then displays translation result
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslate } from '@/hooks/useTranslate'
import { getShadowRoot } from '../index'

interface SelectTransProps {
  text: string
  position: { x: number; y: number }
  targetLanguage: string
  onClose: () => void
}

type State = 'button' | 'loading' | 'result'

const SelectTrans: React.FC<SelectTransProps> = ({ text, position, targetLanguage, onClose }) => {
  const [state, setState] = useState<State>('button')
  const { translate, isLoading, result, error } = useTranslate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [panelPosition, setPanelPosition] = useState(position)
  const [copied, setCopied] = useState<'original' | 'translation' | null>(null)

  // Calculate safe position for the panel
  const calculatePosition = useCallback(() => {
    const padding = 16
    const panelWidth = 380
    const panelHeight = 240
    const buttonSize = 40

    let x = position.x + 10
    let y = position.y + 10

    if (x + panelWidth > window.innerWidth - padding) {
      x = window.innerWidth - panelWidth - padding
    }
    if (x < padding) {
      x = padding
    }
    if (y + panelHeight > window.innerHeight - padding) {
      y = position.y - buttonSize - 10
    }
    if (y < padding) {
      y = padding
    }

    setPanelPosition({ x, y })
  }, [position])

  useEffect(() => {
    calculatePosition()
  }, [calculatePosition])

  const handleTranslate = useCallback(async () => {
    setState('loading')
    await translate(text, targetLanguage)
    setState('result')
  }, [text, targetLanguage, translate])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const shadowRoot = getShadowRoot()
      if (!shadowRoot) return

      const target = e.target as Node
      if (containerRef.current && !containerRef.current.contains(target)) {
        const composedPath = e.composedPath()
        const isInsideShadow = composedPath.some((el) => el === containerRef.current)
        if (!isInsideShadow) {
          onClose()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
    }
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const handleCopy = useCallback(async (textToCopy: string, type: 'original' | 'translation') => {
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(type)
      setTimeout(() => setCopied(null), 1500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [])

  // Render translate button
  if (state === 'button') {
    return (
      <div
        ref={containerRef}
        className="trans-button"
        style={{
          left: `${panelPosition.x}px`,
          top: `${panelPosition.y}px`,
        }}
        onClick={handleTranslate}
        title="Translate"
      >
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
        </svg>
      </div>
    )
  }

  // Render result panel
  return (
    <div
      ref={containerRef}
      className="result-panel"
      style={{
        left: `${panelPosition.x}px`,
        top: `${panelPosition.y}px`,
      }}
    >
      <div className="result-header">
        <span className="result-header-title">{isLoading ? 'Translating...' : 'Translation'}</span>
        <button className="result-close" onClick={onClose} title="Close">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="result-content">
        {isLoading ? (
          <div className="result-loading">
            <div className="loading-spinner" />
            <span className="loading-text">Translating with AI...</span>
          </div>
        ) : error ? (
          <div className="result-error">{error}</div>
        ) : result ? (
          <>
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-label">Original</span>
                <button
                  className="result-copy"
                  onClick={() => handleCopy(text, 'original')}
                  title="Copy"
                >
                  {copied === 'original' ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="result-original">{text}</div>
            </div>

            <div className="result-section">
              <div className="result-section-header">
                <span className="result-label">Translation</span>
                <button
                  className="result-copy"
                  onClick={() => handleCopy(result.translatedText, 'translation')}
                  title="Copy"
                >
                  {copied === 'translation' ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <div className="result-translated">{result.translatedText}</div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default SelectTrans
