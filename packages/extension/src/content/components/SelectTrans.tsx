/**
 * Selection Translation Component
 * Shows a translate button on text selection, then displays translation result
 * Supports dual translation: machine (fast) + LLM (high quality)
 * Supports dragging to reposition the panel
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslate, DualTranslationResult } from '@/hooks/useTranslate'
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
  const { dualTranslate, isLoading, error } = useTranslate()
  const [dualResult, setDualResult] = useState<DualTranslationResult | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [panelPosition, setPanelPosition] = useState(position)
  const [copied, setCopied] = useState<'original' | 'machine' | 'llm' | null>(null)

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  // Calculate safe position for the panel
  const calculatePosition = useCallback(() => {
    const padding = 12
    const panelWidth = 360
    const panelHeight = 280
    const buttonSize = 32

    let x = position.x + 8
    let y = position.y + 8

    if (x + panelWidth > window.innerWidth - padding) {
      x = window.innerWidth - panelWidth - padding
    }
    if (x < padding) {
      x = padding
    }
    if (y + panelHeight > window.innerHeight - padding) {
      y = position.y - buttonSize - 8
    }
    if (y < padding) {
      y = padding
    }

    setPanelPosition({ x, y })
  }, [position])

  useEffect(() => {
    calculatePosition()
  }, [calculatePosition])

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // Only start drag from header area
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      dragOffsetRef.current = {
        x: e.clientX - panelPosition.x,
        y: e.clientY - panelPosition.y,
      }
    },
    [panelPosition]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const padding = 8
      let newX = e.clientX - dragOffsetRef.current.x
      let newY = e.clientY - dragOffsetRef.current.y

      // Keep panel within viewport
      newX = Math.max(padding, Math.min(newX, window.innerWidth - 100))
      newY = Math.max(padding, Math.min(newY, window.innerHeight - 50))

      setPanelPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleTranslate = useCallback(async () => {
    console.log('[MeiTrans] Translate button clicked, text:', text.substring(0, 50))
    setState('loading')
    try {
      const result = await dualTranslate(text, targetLanguage)
      console.log('[MeiTrans] Translation result:', result)
      if (result) {
        setDualResult(result)
      }
    } catch (err) {
      console.error('[MeiTrans] Translation error:', err)
    }
    setState('result')
  }, [text, targetLanguage, dualTranslate])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close while dragging
      if (isDragging) return

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
  }, [onClose, isDragging])

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

  const handleCopy = useCallback(
    async (textToCopy: string, type: 'original' | 'machine' | 'llm') => {
      try {
        await navigator.clipboard.writeText(textToCopy)
        setCopied(type)
        setTimeout(() => setCopied(null), 1500)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    },
    []
  )

  // Copy button component
  const CopyButton = ({ onClick, isCopied }: { onClick: () => void; isCopied: boolean }) => (
    <button className="result-copy" onClick={onClick} title="Copy">
      {isCopied ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          width="12"
          height="12"
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
  )

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
        maxWidth: '360px',
      }}
    >
      <div
        className={`result-header ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleDragStart}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <span className="result-header-title">
          {/* Drag handle icon */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="drag-handle"
            style={{ opacity: 0.5, marginRight: 2 }}
          >
            <circle cx="9" cy="5" r="1" fill="currentColor" />
            <circle cx="9" cy="12" r="1" fill="currentColor" />
            <circle cx="9" cy="19" r="1" fill="currentColor" />
            <circle cx="15" cy="5" r="1" fill="currentColor" />
            <circle cx="15" cy="12" r="1" fill="currentColor" />
            <circle cx="15" cy="19" r="1" fill="currentColor" />
          </svg>
          {isLoading ? 'Translating...' : 'Translation'}
        </span>
        <button
          className="result-close"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          title="Close"
        >
          <svg
            width="12"
            height="12"
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
            <span className="loading-text">Translating...</span>
          </div>
        ) : error ? (
          <div className="result-error">{error}</div>
        ) : dualResult ? (
          <>
            {/* Original Text */}
            <div className="result-section">
              <div className="result-section-header">
                <span className="result-label">Original</span>
                <CopyButton
                  onClick={() => handleCopy(text, 'original')}
                  isCopied={copied === 'original'}
                />
              </div>
              <div className="result-original">{text}</div>
            </div>

            {/* Machine Translation - Always show if available */}
            {dualResult.machine.translatedText && (
              <div className="result-section">
                <div className="result-section-header">
                  <span className="result-label">
                    ⚡ Machine
                    {dualResult.machine.provider && (
                      <span className="result-provider">({dualResult.machine.provider})</span>
                    )}
                  </span>
                  <CopyButton
                    onClick={() => handleCopy(dualResult.machine.translatedText!, 'machine')}
                    isCopied={copied === 'machine'}
                  />
                </div>
                <div className="result-translated">{dualResult.machine.translatedText}</div>
              </div>
            )}

            {/* LLM Translation - Show if available and configured */}
            {dualResult.llm.available && (
              <div className="result-section">
                <div className="result-section-header">
                  <span className="result-label">
                    ✨ AI
                    {dualResult.llm.model && (
                      <span className="result-provider">({dualResult.llm.model})</span>
                    )}
                  </span>
                  {dualResult.llm.translatedText && (
                    <CopyButton
                      onClick={() => handleCopy(dualResult.llm.translatedText!, 'llm')}
                      isCopied={copied === 'llm'}
                    />
                  )}
                </div>
                {dualResult.llm.translatedText ? (
                  <div className="result-translated result-llm">
                    {dualResult.llm.translatedText}
                  </div>
                ) : dualResult.llm.error ? (
                  <div className="result-error-inline">{dualResult.llm.error}</div>
                ) : (
                  <div className="result-loading-inline">
                    <div className="loading-spinner-small" />
                    <span>AI translating...</span>
                  </div>
                )}
              </div>
            )}

            {/* Show message if LLM not configured */}
            {!dualResult.llm.available && (
              <div className="result-hint">
                💡 Configure LLM API key in settings for higher quality AI translation
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

export default SelectTrans
