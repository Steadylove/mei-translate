/**
 * Hook for detecting text selection
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { isAllNumber, isAllPunctuation } from '@/lib/utils'

export interface SelectionData {
  text: string
  position: { x: number; y: number }
  targetElement: Element | null
}

export interface UseSelectionReturn {
  selection: SelectionData | null
  clearSelection: () => void
}

export function useSelection(): UseSelectionReturn {
  const [selection, setSelection] = useState<SelectionData | null>(null)
  const isSelecting = useRef(false)

  const clearSelection = useCallback(() => {
    setSelection(null)
  }, [])

  useEffect(() => {
    const handleMouseDown = () => {
      isSelecting.current = true
      // Clear previous selection when starting new selection
      setSelection(null)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting.current) return
      isSelecting.current = false

      // Only handle left click
      if (e.button !== 0) return

      // Get selection
      const windowSelection = window.getSelection()
      const text = windowSelection?.toString()?.trim() || ''

      // Skip if no text, only numbers, or only punctuation
      if (!text || isAllNumber(text) || isAllPunctuation(text)) {
        return
      }

      // Skip if selection is too long (likely accidental)
      if (text.length > 5000) {
        return
      }

      const targetElement = e.target as Element

      setSelection({
        text,
        position: { x: e.clientX, y: e.clientY },
        targetElement,
      })
    }

    // Listen for selections from child frames
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SELECTION-FROM-WEBTRANS') {
        const { selectedValue, selectPosition } = event.data.data

        if (selectedValue && !isAllNumber(selectedValue) && !isAllPunctuation(selectedValue)) {
          setSelection({
            text: selectedValue,
            position: selectPosition,
            targetElement: null,
          })
        }
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('message', handleMessage)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  return { selection, clearSelection }
}
