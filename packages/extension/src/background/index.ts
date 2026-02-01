/**
 * Background Service Worker
 * Handles message passing, context menus, and storage management
 */

import { translate, detectLanguage, batchTranslate } from '@/services/translate'
import Storage from '@/services/storage'

// Message types
export enum MessageType {
  TRANSLATE = 'translate',
  DETECT_LANG = 'detectLang',
  BATCH_TRANSLATE = 'batchTranslate',
  GET_SETTINGS = 'getSettings',
  SET_SETTING = 'setSetting',
  SHOW_WEB_TRANS = 'showWebTrans',
  OPEN_PDF_VIEWER = 'openPdfViewer',
}

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
      const { text, targetLanguage } = args as { text: string; targetLanguage: string }
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
        `src/options/index.html?page=pdf${fileUrl ? `&fileUrl=${encodeURIComponent(fileUrl)}` : ''}`
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
