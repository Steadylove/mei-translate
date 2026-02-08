/**
 * Background Service Worker
 * Handles message passing, context menus, and storage management
 */

import {
  translate,
  dualTranslate,
  detectLanguage,
  batchTranslate,
  refineTranslation,
} from '@/services/translate'
import Storage from '@/services/storage'
import { MessageType } from '@/types/messages'

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Web Translator Extension installed')

  // Initialize default settings
  const settings = await Storage.getAllSettings()
  await Storage.setMultiple(settings)

  // Create context menu
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate "%s"',
    contexts: ['selection'],
  })

  chrome.contextMenus.create({
    id: 'translate-page',
    title: 'Translate this page',
    contexts: ['page'],
  })
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    // Send translation request to content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'showResultDialog',
      args: { text: info.selectionText },
    })
  }

  if (info.menuItemId === 'translate-page') {
    chrome.tabs.sendMessage(tab.id, {
      type: 'show-web-trans-toolbar',
      args: { actionFrom: 'context_menu' },
    })
  }
})

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) return

  chrome.tabs.sendMessage(tab.id, {
    type: 'command_from_hotkey',
    args: { command },
  })
})

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => {
      console.error('Message handler error:', err)
      sendResponse({ error: err.message })
    })

  // Return true to indicate async response
  return true
})

async function handleMessage(message: { type: MessageType; args?: Record<string, unknown> }) {
  const { type, args } = message

  switch (type) {
    case MessageType.TRANSLATE: {
      const { text, targetLanguage, dual } = args as {
        text: string
        targetLanguage: string
        dual?: boolean
      }
      console.log('[MeiTrans BG] Translate request, dual:', dual, 'text:', text.substring(0, 30))
      // Use dual translation if requested
      if (dual) {
        console.log('[MeiTrans BG] Using dualTranslate')
        const result = await dualTranslate({ text, targetLanguage })
        console.log('[MeiTrans BG] dualTranslate result:', result)
        return result
      }
      return translate({ text, targetLanguage })
    }

    case MessageType.DETECT_LANG: {
      const { text } = args as { text: string }
      return detectLanguage(text)
    }

    case MessageType.BATCH_TRANSLATE: {
      const { texts, sourceLanguage, targetLanguage } = args as {
        texts: string[]
        sourceLanguage?: string
        targetLanguage: string
      }
      return batchTranslate({ texts, sourceLanguage, targetLanguage })
    }

    case MessageType.REFINE_TRANSLATE: {
      const { originalText, currentTranslation, instruction, history, targetLang, sourceLang } =
        args as {
          originalText: string
          currentTranslation: string
          instruction: string
          history: Array<{ role: 'user' | 'assistant'; content: string }>
          targetLang: string
          sourceLang?: string
        }
      console.log('[MeiTrans BG] Refine request, instruction:', instruction.substring(0, 50))
      return refineTranslation({
        originalText,
        currentTranslation,
        instruction,
        history: history || [],
        targetLang,
        sourceLang,
      })
    }

    case MessageType.GET_SETTINGS: {
      return Storage.getAllSettings()
    }

    case MessageType.SET_SETTING: {
      const { key, value } = args as { key: string; value: unknown }
      await Storage.set(key as keyof import('@/services/storage').StorageData, value as never)
      return { success: true }
    }

    case MessageType.OPEN_PDF_VIEWER: {
      const { fileUrl } = args as { fileUrl?: string }
      const url = chrome.runtime.getURL(
        `options.html?page=pdf${fileUrl ? `&fileUrl=${encodeURIComponent(fileUrl)}` : ''}`
      )
      chrome.tabs.create({ url })
      return { success: true }
    }

    default:
      return { error: 'Unknown message type' }
  }
}

// Keep service worker alive
chrome.runtime.onConnect.addListener(() => {
  console.log('Client connected to background')
})

export {}
