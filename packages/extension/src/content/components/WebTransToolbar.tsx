/**
 * Web Page Translation Toolbar Component
 * Provides controls for translating entire web pages
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  startWebTranslation,
  stopWebTranslation,
  setDisplayMode,
  DisplayMode,
  setTargetLanguage as setWebTransTargetLang,
  subscribeTranslationStatus,
} from '@/lib/webpage-translation'
import Storage from '@/services/storage'

interface WebTransToolbarProps {
  action: string
  targetLanguage: string
  onTargetLanguageChange: (lang: string) => void
  onClose: () => void
}

type TranslationState = 'idle' | 'translating' | 'translated'
type ToolbarPosition = { x: number; y: number }
type ToolbarOption<T extends string | number> = { value: T; label: string }

const LANGUAGES = [
  { value: 'zh', label: 'Chinese' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'ru', label: 'Russian' },
]

const DISPLAY_MODES = [
  { value: DisplayMode.COMPARISON, label: 'Both' },
  { value: DisplayMode.TRANSLATE, label: 'Translation' },
  { value: DisplayMode.ORIGIN, label: 'Original' },
]

interface ToolbarSelectProps<T extends string | number> {
  value: T
  options: Array<ToolbarOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

function ToolbarSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: ToolbarSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return

    const rootNode = rootRef.current?.getRootNode()
    const eventTarget = rootNode instanceof ShadowRoot ? rootNode : document
    const handlePointerDown = (event: Event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return
      setOpen(false)
    }

    eventTarget.addEventListener('mousedown', handlePointerDown)

    return () => eventTarget.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  return (
    <div className={`toolbar-select ${className ?? ''}`} ref={rootRef}>
      <button
        type="button"
        className="toolbar-select-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        <span>{selectedOption.label}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="toolbar-select-menu" role="listbox">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={
                option.value === value ? 'toolbar-select-item selected' : 'toolbar-select-item'
              }
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              <span className="toolbar-select-check">{option.value === value ? '✓' : ''}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const WebTransToolbar: React.FC<WebTransToolbarProps> = ({
  targetLanguage,
  onTargetLanguageChange,
  onClose,
}) => {
  const [state, setState] = useState<TranslationState>('translating')
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(DisplayMode.COMPARISON)
  const [collapsed, setCollapsed] = useState(false)
  const [position, setPosition] = useState<ToolbarPosition>({ x: window.innerWidth - 340, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const hasStartedRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })
  const dragStartRef = useRef({ x: 0, y: 0 })
  const hasDraggedRef = useRef(false)
  const iconUrl = chrome.runtime.getURL('assets/icon48.png')

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

  useEffect(() => {
    if (hasStartedRef.current) return

    hasStartedRef.current = true
    setDisplayMode(displayMode)
    handleTranslate()
  }, [displayMode, handleTranslate])

  useEffect(() => {
    return subscribeTranslationStatus((status) => {
      setState((currentState) => {
        if (status === 'translating') {
          return 'translating'
        }

        return currentState === 'translating' ? 'translated' : currentState
      })
    })
  }, [])

  const handleDisplayModeChange = useCallback((mode: DisplayMode) => {
    setDisplayMode(mode)
    setDisplayModeState(mode)
  }, [])

  const handleStop = useCallback(() => {
    stopWebTranslation()
    setState('idle')
  }, [])

  const handleLanguageChange = useCallback(
    async (newLang: string) => {
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

  const handleDragStart = useCallback(
    (e: React.MouseEvent, allowInteractiveDrag = false) => {
      if (e.button !== 0) return

      const target = e.target as HTMLElement
      if (!allowInteractiveDrag && target.closest('button, .toolbar-select')) return

      e.preventDefault()
      setIsDragging(true)
      hasDraggedRef.current = false
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
      }
      dragOffsetRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }
    },
    [position]
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (
        Math.abs(e.clientX - dragStartRef.current.x) > 4 ||
        Math.abs(e.clientY - dragStartRef.current.y) > 4
      ) {
        hasDraggedRef.current = true
      }

      const toolbarWidth = collapsed ? 44 : 320
      const toolbarHeight = 42
      const padding = 8

      setPosition({
        x: Math.max(
          padding,
          Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - toolbarWidth - padding)
        ),
        y: Math.max(
          padding,
          Math.min(
            e.clientY - dragOffsetRef.current.y,
            window.innerHeight - toolbarHeight - padding
          )
        ),
      })
    }

    const handleMouseUp = () => setIsDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [collapsed, isDragging])

  const statusLabel = state === 'translating' ? 'Translating...' : 'Translated'

  const handleCollapsedClick = useCallback(() => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false
      return
    }

    setCollapsed(false)
  }, [])

  if (collapsed) {
    return (
      <div
        className={`webtrans-toolbar collapsed ${isDragging ? 'dragging' : ''}`}
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onMouseDown={handleDragStart}
      >
        <button
          className="toolbar-icon-button"
          onMouseDown={(e) => handleDragStart(e, true)}
          onClick={handleCollapsedClick}
          title="Expand"
          aria-label="Expand translation toolbar"
        >
          <img className="toolbar-icon-image" src={iconUrl} alt="" draggable={false} />
          {state === 'translating' && <span className="toolbar-icon-status" />}
        </button>
      </div>
    )
  }

  return (
    <div
      className={`webtrans-toolbar ${isDragging ? 'dragging' : ''}`}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onMouseDown={handleDragStart}
    >
      <span className={state === 'translating' ? 'toolbar-dot loading' : 'toolbar-dot'} />

      <ToolbarSelect
        value={targetLanguage}
        options={LANGUAGES}
        onChange={handleLanguageChange}
        ariaLabel="Target language"
      />

      <div className="toolbar-divider" />

      {/* Action buttons based on state */}
      {state === 'translating' ? (
        <span className="toolbar-status">{statusLabel}</span>
      ) : (
        <ToolbarSelect
          value={displayMode}
          options={DISPLAY_MODES}
          onChange={handleDisplayModeChange}
          ariaLabel="Display mode"
          className="mode-select"
        />
      )}

      {state === 'translated' && (
        <button className="btn-secondary compact" onClick={handleStop}>
          Reset
        </button>
      )}

      <button className="btn-close" onClick={() => setCollapsed(true)} title="Collapse">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M8 12h8" />
        </svg>
      </button>

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
