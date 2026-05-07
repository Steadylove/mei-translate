/**
 * Main Content Script App Component
 * Manages selection translation and web page translation
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useSelection } from '@/hooks/useSelection'
import SelectTrans from './components/SelectTrans'
import WebTransToolbar from './components/WebTransToolbar'
import Storage from '@/services/storage'

interface ContextMenuSelection {
  text: string
  position: { x: number; y: number }
}

interface ChromeMessage {
  type: string
  args?: Record<string, unknown>
}

const App: React.FC = () => {
  const { selection, clearSelection } = useSelection()
  const [showWebTrans, setShowWebTrans] = useState(false)
  const [webTransAction, setWebTransAction] = useState<string>('')
  const [isBlacklisted, setIsBlacklisted] = useState(false)
  const [targetLanguage, setTargetLanguage] = useState('zh')
  const [contextMenuSelection, setContextMenuSelection] = useState<ContextMenuSelection | null>(
    null
  )

  // Check if current site is blacklisted
  useEffect(() => {
    const checkBlacklist = async () => {
      const blackList = await Storage.get('blackList', [])
      const host = window.location.host
      setIsBlacklisted(blackList.includes(host))
    }

    checkBlacklist()

    // Listen for storage changes
    Storage.onStorageChange((changes) => {
      if (changes.blackList) {
        const host = window.location.host
        setIsBlacklisted(changes.blackList.newValue?.includes(host) || false)
      }
      if (changes.targetLanguage) {
        setTargetLanguage(changes.targetLanguage.newValue || 'zh')
      }
    })
  }, [])

  // Load initial target language
  useEffect(() => {
    Storage.get('targetLanguage', 'zh').then(setTargetLanguage)
  }, [])

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
          setShowWebTrans(true)
          setWebTransAction((args?.actionFrom as string) || 'hotkey')
          break

        case 'command_from_hotkey':
          if (args?.command === 'toggle_web_trans') {
            setShowWebTrans((prev) => !prev)
            setWebTransAction('hotkey')
          }
          break

        case 'showResultDialog':
          // Handle right-click translate - show result at center
          if (args?.text) {
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
  }, [clearSelection])

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
      {/* Selection Translation */}
      {selection && (
        <SelectTrans
          text={selection.text}
          position={selection.position}
          targetLanguage={targetLanguage}
          onClose={handleCloseSelection}
        />
      )}

      {contextMenuSelection && (
        <SelectTrans
          text={contextMenuSelection.text}
          position={contextMenuSelection.position}
          targetLanguage={targetLanguage}
          onClose={handleCloseSelection}
          autoStart
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
