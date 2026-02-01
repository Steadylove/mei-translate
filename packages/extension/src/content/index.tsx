/**
 * Content Script Entry Point
 * Injects the translator UI into web pages using Shadow DOM
 */

import { createRoot } from 'react-dom/client'
import App from './App'
import { isTopFrame } from '@/lib/utils'
import { initWebTranslation } from '@/lib/webpage-translation'

// Container elements
let appContainer: HTMLElement | null = null
let shadowRoot: ShadowRoot | null = null

/**
 * Prepare Shadow DOM container for the extension UI
 */
function prepareShadowDOM() {
  appContainer = document.createElement('web-translator-ext')
  appContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
  `

  shadowRoot = appContainer.attachShadow({ mode: 'open' })

  // Inject styles into Shadow DOM
  const styleSheet = document.createElement('style')
  styleSheet.textContent = getStyles()
  shadowRoot.appendChild(styleSheet)

  document.documentElement.appendChild(appContainer)
}

/**
 * Get CSS styles for the Shadow DOM
 */
function getStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    :host {
      all: initial;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .translator-root {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }

    /* Translation Button */
    .trans-button {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      pointer-events: auto;
      box-shadow:
        0 4px 14px rgba(139, 92, 246, 0.4),
        0 0 0 3px rgba(139, 92, 246, 0.1);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      animation: buttonPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes buttonPop {
      0% {
        opacity: 0;
        transform: scale(0.5);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }

    .trans-button:hover {
      transform: scale(1.08);
      box-shadow:
        0 6px 20px rgba(139, 92, 246, 0.5),
        0 0 0 4px rgba(139, 92, 246, 0.15);
    }

    .trans-button:active {
      transform: scale(0.95);
    }

    .trans-button svg {
      width: 18px;
      height: 18px;
      fill: white;
    }

    /* Result Panel */
    .result-panel {
      position: absolute;
      min-width: 320px;
      max-width: 420px;
      max-height: 400px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow:
        0 20px 50px rgba(0, 0, 0, 0.12),
        0 0 0 1px rgba(0, 0, 0, 0.05);
      pointer-events: auto;
      overflow: hidden;
      animation: panelSlide 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes panelSlide {
      0% {
        opacity: 0;
        transform: translateY(-12px) scale(0.96);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .result-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
      border-bottom: 1px solid #e9e5ff;
    }

    .result-header-title {
      font-weight: 600;
      font-size: 13px;
      color: #6d28d9;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .result-header-title::before {
      content: '';
      display: block;
      width: 8px;
      height: 8px;
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      border-radius: 50%;
    }

    .result-close {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: rgba(139, 92, 246, 0.1);
      cursor: pointer;
      border-radius: 8px;
      color: #7c3aed;
      transition: all 0.15s ease;
    }

    .result-close:hover {
      background: rgba(139, 92, 246, 0.2);
      transform: rotate(90deg);
    }

    .result-content {
      padding: 18px;
      max-height: 320px;
      overflow-y: auto;
    }

    .result-content::-webkit-scrollbar {
      width: 6px;
    }

    .result-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .result-content::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 3px;
    }

    .result-section {
      margin-bottom: 14px;
    }

    .result-section:last-child {
      margin-bottom: 0;
    }

    .result-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .result-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
    }

    .result-copy {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      border-radius: 6px;
      transition: all 0.15s ease;
    }

    .result-copy:hover {
      background: #f1f5f9;
      color: #64748b;
    }

    .result-original {
      font-size: 13px;
      color: #64748b;
      line-height: 1.6;
      padding: 12px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #f1f5f9;
    }

    .result-translated {
      font-size: 15px;
      color: #1e293b;
      line-height: 1.7;
      padding: 12px;
      background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%);
      border-radius: 10px;
      border: 1px solid #ede9fe;
    }

    .result-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      gap: 12px;
    }

    .loading-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #ede9fe;
      border-top-color: #8b5cf6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .loading-text {
      font-size: 13px;
      color: #64748b;
    }

    .result-error {
      padding: 16px;
      background: #fef2f2;
      border-radius: 10px;
      color: #dc2626;
      font-size: 13px;
      border: 1px solid #fecaca;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Web Translation Toolbar */
    .webtrans-toolbar {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 16px;
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.08),
        0 0 0 1px rgba(0, 0, 0, 0.04);
      pointer-events: auto;
      z-index: 2147483647;
      animation: toolbarSlide 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes toolbarSlide {
      0% {
        opacity: 0;
        transform: translateY(-16px) scale(0.95);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .webtrans-toolbar select {
      padding: 8px 12px;
      padding-right: 28px;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 500;
      background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center;
      cursor: pointer;
      color: #334155;
      appearance: none;
      transition: all 0.15s ease;
    }

    .webtrans-toolbar select:hover {
      border-color: #cbd5e1;
    }

    .webtrans-toolbar select:focus {
      outline: none;
      border-color: #8b5cf6;
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }

    .webtrans-toolbar button {
      padding: 8px 16px;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s ease;
    }

    .webtrans-toolbar .btn-primary {
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
    }

    .webtrans-toolbar .btn-primary:hover {
      box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);
      transform: translateY(-1px);
    }

    .webtrans-toolbar .btn-primary:active {
      transform: translateY(0);
    }

    .webtrans-toolbar .btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }

    .webtrans-toolbar .btn-secondary:hover {
      background: #e2e8f0;
    }

    .webtrans-toolbar .btn-close {
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: #94a3b8;
      border-radius: 8px;
    }

    .webtrans-toolbar .btn-close:hover {
      color: #64748b;
      background: #f1f5f9;
    }

    .toolbar-divider {
      width: 1px;
      height: 24px;
      background: #e2e8f0;
      margin: 0 4px;
    }
  `
}

/**
 * Get the Shadow DOM root
 */
export function getShadowRoot(): ShadowRoot | null {
  return shadowRoot
}

/**
 * Get the app container
 */
export function getAppContainer(): HTMLElement | null {
  return appContainer
}

/**
 * Initialize translator in top frame
 */
function initTranslator() {
  prepareShadowDOM()

  if (!shadowRoot) return

  const container = document.createElement('div')
  container.className = 'translator-root'
  shadowRoot.appendChild(container)

  const root = createRoot(container)
  root.render(<App />)
}

/**
 * Initialize child frame selection handling
 */
function initChildFrame() {
  let selecting = false

  document.addEventListener('mousedown', () => {
    selecting = true
  })

  document.addEventListener('mouseup', (e) => {
    if (e.button === 0 && selecting) {
      const text = window.getSelection()?.toString()?.trim() || ''
      if (text) {
        window.top?.postMessage(
          {
            type: 'SELECTION-FROM-WEBTRANS',
            data: {
              selectedValue: text,
              selectPosition: { x: e.clientX, y: e.clientY },
            },
          },
          '*'
        )
      }
      selecting = false
    }
  })
}

/**
 * Main initialization
 */
function main() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
}

function init() {
  if (isTopFrame()) {
    initTranslator()
    initWebTranslation()
  } else {
    initChildFrame()
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  window.dispatchEvent(new CustomEvent('webtrans-message', { detail: message }))
  sendResponse({ received: true })
  return true
})

// Start
main()
