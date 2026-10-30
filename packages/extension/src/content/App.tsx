/**
 * Main Content Script App Component
 * Manages selection translation and web page translation
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useSelection } from '@/hooks/useSelection'
import SelectTrans from './components/SelectTrans'
import WebTransToolbar from './components/WebTransToolbar'
import Storage from '@/services/storage'
import { stopWebTranslation } from '@/lib/webpage-translation'
import { analyzePageContext, PageContext } from '@/services/translate'

interface ContextMenuSelection {
  text: string
  position: { x: number; y: number }
}

interface ChromeMessage {
  type: string
  args?: Record<string, unknown>
}

function collectReadingContext(): string {
  const title = document.title.trim()
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
    .map((node) => node.textContent?.trim())
    .filter(Boolean)
    .slice(0, 40)
    .join('\n')
  const bodyText = document.body?.innerText?.replace(/\s+/g, ' ').trim() || ''

  return [`Title: ${title}`, headings ? `Headings:\n${headings}` : '', bodyText]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 12000)
}

const App: React.FC = () => {
  const { selection, clearSelection } = useSelection()
  const [showWebTrans, setShowWebTrans] = useState(false)
  const [webTransAction, setWebTransAction] = useState<string>('')
  const [isBlacklisted, setIsBlacklisted] = useState(false)
  const [selectionEnabled, setSelectionEnabled] = useState(true)
  const [webTransEnabled, setWebTransEnabled] = useState(true)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState('zh')
  const [pageContext, setPageContext] = useState<PageContext | null>(null)
  const [readingStatus, setReadingStatus] = useState<'collecting' | 'complete' | null>(null)
  const [contextMenuSelection, setContextMenuSelection] = useState<ContextMenuSelection | null>(
    null
  )

  // Check if current site is blacklisted
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await Storage.getMultiple([
        'blackList',
        'selectionTransEnabled',
        'webTransEnabled',
        'autoSpeak',
        'targetLanguage',
      ])
      const host = window.location.host
      setIsBlacklisted(settings.blackList.includes(host))
      setSelectionEnabled(settings.selectionTransEnabled)
      setWebTransEnabled(settings.webTransEnabled)
      setAutoSpeak(settings.autoSpeak)
      setTargetLanguage(settings.targetLanguage)
    }

    loadSettings()

    // Listen for storage changes
    Storage.onStorageChange((changes) => {
      if (changes.blackList) {
        const host = window.location.host
        setIsBlacklisted(changes.blackList.newValue?.includes(host) || false)
      }
      if (changes.targetLanguage) {
        setTargetLanguage(changes.targetLanguage.newValue || 'zh')
      }
      if (changes.selectionTransEnabled) {
        setSelectionEnabled(changes.selectionTransEnabled.newValue !== false)
      }
      if (changes.webTransEnabled) {
        setWebTransEnabled(changes.webTransEnabled.newValue !== false)
      }
      if (changes.autoSpeak) {
        setAutoSpeak(changes.autoSpeak.newValue === true)
      }
    })
  }, [])

  // Load initial target language
  useEffect(() => {
    Storage.get('targetLanguage', 'zh').then(setTargetLanguage)
  }, [])

  // Build hidden page context for the Reading Agent.
  useEffect(() => {
    if (isBlacklisted) return

    let cancelled = false
    const collect = async () => {
      setReadingStatus('collecting')
      try {
        const context = await analyzePageContext(
          collectReadingContext(),
          window.location.href,
          document.title
        )
        if (cancelled) return
        setPageContext(context)
        setReadingStatus('complete')
        window.setTimeout(() => {
          if (!cancelled) setReadingStatus(null)
        }, 1200)
      } catch {
        if (!cancelled) setReadingStatus(null)
      }
    }

    collect()
    return () => {
      cancelled = true
    }
  }, [isBlacklisted])

  // Close active UI immediately when its feature is disabled.
  useEffect(() => {
    if (!selectionEnabled) {
      clearSelection()
      setContextMenuSelection(null)
    }
  }, [selectionEnabled, clearSelection])

  useEffect(() => {
    if (!webTransEnabled) {
      stopWebTranslation()
      setShowWebTrans(false)
      setWebTransAction('')
    }
  }, [webTransEnabled])

  // Listen for messages from background
  useEffect(() => {
    const getSelectionPosition = () => {
      const selectedRange = window.getSelection()?.rangeCount
        ? window.getSelection()?.getRangeAt(0)
        : null
      const rect = selectedRange?.getBoundingClientRect()

      if (rect && (rect.width > 0 || rect.height > 0)) {
        return {
          x: rect.left + Math.min(rect.width, 240),
          y: rect.bottom + 8,
        }
      }

      return {
        x: window.innerWidth / 2 - 280,
        y: Math.max(24, window.innerHeight / 2 - 180),
      }
    }

    const handleMessage = (event: CustomEvent<ChromeMessage>) => {
      const { type, args } = event.detail

      switch (type) {
        case 'show-web-trans-toolbar':
          if (!webTransEnabled) break
          setShowWebTrans(true)
          setWebTransAction((args?.actionFrom as string) || 'hotkey')
          break

        case 'command_from_hotkey':
          if (args?.command === 'toggle_web_trans' && webTransEnabled) {
            setShowWebTrans((prev) => !prev)
            setWebTransAction('hotkey')
          }
          break

        case 'showResultDialog':
          // Handle right-click translate - show result at center
          if (selectionEnabled && args?.text) {
            clearSelection()
            setContextMenuSelection({
              text: String(args.text),
              position: getSelectionPosition(),
            })
          }
          break
      }
    }

    window.addEventListener('webtrans-message', handleMessage as EventListener)
    return () => {
      window.removeEventListener('webtrans-message', handleMessage as EventListener)
    }
  }, [clearSelection, selectionEnabled, webTransEnabled])

  const handleCloseWebTrans = useCallback(() => {
    setShowWebTrans(false)
    setWebTransAction('')
  }, [])

  const handleCloseSelection = useCallback(() => {
    clearSelection()
    setContextMenuSelection(null)
  }, [clearSelection])

  // Don't render if blacklisted
  if (isBlacklisted) {
    return null
  }

  return (
    <>
      {readingStatus && (
        <div className="reading-status" aria-live="polite">
          <span className="reading-status-dot" />
          {readingStatus === 'collecting' ? 'Understanding page…' : 'Ready'}
        </div>
      )}

      {/* Selection Translation */}
      {selectionEnabled && selection && (
        <SelectTrans
          text={selection.text}
          position={selection.position}
          targetLanguage={targetLanguage}
          onClose={handleCloseSelection}
          autoSpeak={autoSpeak}
          pageContext={pageContext || undefined}
        />
      )}

      {selectionEnabled && contextMenuSelection && (
        <SelectTrans
          text={contextMenuSelection.text}
          position={contextMenuSelection.position}
          targetLanguage={targetLanguage}
          onClose={handleCloseSelection}
          autoStart
          autoSpeak={autoSpeak}
          pageContext={pageContext || undefined}
        />
      )}

      {/* Web Page Translation Toolbar */}
      {showWebTrans && (
        <WebTransToolbar
          action={webTransAction}
          targetLanguage={targetLanguage}
          onTargetLanguageChange={setTargetLanguage}
          onClose={handleCloseWebTrans}
        />
      )}
    </>
  )
}

export default App
