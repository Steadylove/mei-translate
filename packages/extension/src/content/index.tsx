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
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&display=swap');

    :host {
      all: initial;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .translator-root {
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }

    /* Translation Button */
    .trans-button {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%);
      border: none;
      border-radius: 10px;
      cursor: pointer;
      pointer-events: auto;
      box-shadow:
        0 3px 12px rgba(13, 148, 136, 0.35),
        0 0 0 2px rgba(13, 148, 136, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      animation: buttonPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes buttonPop {
      0% {
        opacity: 0;
        transform: scale(0.3) rotate(-10deg);
      }
      50% {
        transform: scale(1.1) rotate(2deg);
      }
      100% {
        opacity: 1;
        transform: scale(1) rotate(0deg);
      }
    }

    .trans-button:hover {
      transform: scale(1.1) translateY(-2px);
      box-shadow:
        0 8px 30px rgba(13, 148, 136, 0.45),
        0 0 0 4px rgba(13, 148, 136, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }

    .trans-button:active {
      transform: scale(0.95);
      transition-duration: 0.1s;
    }

    .trans-button svg {
      width: 16px;
      height: 16px;
      fill: white;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
    }

    /* Result Panel */
    .result-panel {
      position: absolute;
      min-width: 280px;
      max-width: 360px;
      max-height: 360px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 14px;
      box-shadow:
        0 16px 40px rgba(0, 0, 0, 0.12),
        0 0 0 1px rgba(0, 0, 0, 0.04);
      pointer-events: auto;
      overflow: hidden;
      animation: panelSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes panelSlide {
      0% {
        opacity: 0;
        transform: translateY(-20px) scale(0.92);
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
      padding: 10px 14px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      border-bottom: none;
      cursor: grab;
      user-select: none;
      transition: background 0.2s ease;
    }

    .result-header:hover {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    }

    .result-header:active,
    .result-header.dragging {
      cursor: grabbing;
      background: linear-gradient(135deg, #334155 0%, #475569 100%);
    }

    .result-header .drag-handle {
      transition: opacity 0.2s ease;
    }

    .result-header:hover .drag-handle {
      opacity: 0.8 !important;
    }

    .result-header-title {
      font-weight: 600;
      font-size: 12px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: -0.01em;
    }

    .result-header-title::before {
      content: '';
      display: block;
      width: 8px;
      height: 8px;
      background: linear-gradient(135deg, #14b8a6, #06b6d4);
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(20, 184, 166, 0.6);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 12px rgba(20, 184, 166, 0.6); }
      50% { opacity: 0.7; box-shadow: 0 0 20px rgba(20, 184, 166, 0.8); }
    }

    .result-close {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      cursor: pointer;
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.7);
      transition: all 0.2s ease;
    }

    .result-close:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
      transform: rotate(90deg);
    }

    .result-content {
      padding: 14px;
      max-height: 300px;
      overflow-y: auto;
    }

    .result-content::-webkit-scrollbar {
      width: 6px;
    }

    .result-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .result-content::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }

    .result-content::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    .result-section {
      margin-bottom: 12px;
      animation: sectionFade 0.3s ease-out;
      animation-fill-mode: both;
    }

    .result-section:nth-child(1) { animation-delay: 0.05s; }
    .result-section:nth-child(2) { animation-delay: 0.1s; }
    .result-section:nth-child(3) { animation-delay: 0.15s; }

    @keyframes sectionFade {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .result-section:last-child {
      margin-bottom: 0;
    }

    .result-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .result-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #64748b;
    }

    .result-copy {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      color: #94a3b8;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .result-copy:hover {
      background: #f1f5f9;
      color: #0d9488;
      transform: scale(1.1);
    }

    .result-original {
      font-size: 12px;
      color: #475569;
      line-height: 1.6;
      padding: 10px 12px;
      background: #f1f5f9;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      transition: all 0.2s ease;
    }

    .result-original:hover {
      background: #e2e8f0;
    }

    .result-translated {
      font-size: 13px;
      color: #0f172a;
      line-height: 1.65;
      padding: 10px 12px;
      background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%);
      border-radius: 10px;
      border: 1px solid #99f6e4;
      transition: all 0.2s ease;
    }

    .result-translated:hover {
      border-color: #5eead4;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.1);
    }

    .result-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 28px;
      gap: 12px;
    }

    .loading-spinner {
      width: 28px;
      height: 28px;
      border: 2px solid #e2e8f0;
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .loading-text {
      font-size: 12px;
      color: #64748b;
      font-weight: 500;
    }

    .result-error {
      padding: 12px;
      background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
      border-radius: 10px;
      color: #dc2626;
      font-size: 12px;
      border: 1px solid #fecaca;
    }

    .result-error-inline {
      padding: 8px 10px;
      background: #fef2f2;
      border-radius: 8px;
      color: #dc2626;
      font-size: 11px;
      border: 1px solid #fecaca;
    }

    .result-provider {
      font-weight: 500;
      color: #94a3b8;
      margin-left: 4px;
      font-size: 9px;
      background: rgba(148, 163, 184, 0.1);
      padding: 2px 5px;
      border-radius: 3px;
    }

    .result-llm {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border: 1px solid #6ee7b7;
    }

    .result-llm:hover {
      border-color: #34d399;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
    }

    .result-hint {
      padding: 10px 12px;
      background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
      border-radius: 8px;
      color: #854d0e;
      font-size: 11px;
      border: 1px solid #fde047;
      margin-top: 10px;
    }

    .result-loading-inline {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: #f8fafc;
      border-radius: 8px;
      color: #64748b;
      font-size: 11px;
    }

    .loading-spinner-small {
      width: 12px;
      height: 12px;
      border: 2px solid #e2e8f0;
      border-top-color: #0d9488;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
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
      gap: 12px;
      padding: 12px 16px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 18px;
      box-shadow:
        0 10px 40px rgba(0, 0, 0, 0.1),
        0 0 0 1px rgba(0, 0, 0, 0.03);
      pointer-events: auto;
      z-index: 2147483647;
      animation: toolbarSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes toolbarSlide {
      0% {
        opacity: 0;
        transform: translateY(-24px) scale(0.9);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .webtrans-toolbar select {
      padding: 10px 14px;
      padding-right: 32px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;
      cursor: pointer;
      color: #1e293b;
      appearance: none;
      transition: all 0.2s ease;
    }

    .webtrans-toolbar select:hover {
      border-color: #0d9488;
      background-color: #f0fdfa;
    }

    .webtrans-toolbar select:focus {
      outline: none;
      border-color: #0d9488;
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
    }

    .webtrans-toolbar button {
      padding: 10px 18px;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .webtrans-toolbar .btn-primary {
      background: linear-gradient(135deg, #0d9488 0%, #0891b2 100%);
      color: white;
      box-shadow: 0 4px 14px rgba(13, 148, 136, 0.35);
    }

    .webtrans-toolbar .btn-primary:hover {
      box-shadow: 0 6px 20px rgba(13, 148, 136, 0.45);
      transform: translateY(-2px);
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
      transform: translateY(-1px);
    }

    .webtrans-toolbar .btn-close {
      width: 34px;
      height: 34px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: #94a3b8;
      border-radius: 10px;
    }

    .webtrans-toolbar .btn-close:hover {
      color: #ef4444;
      background: #fef2f2;
      transform: rotate(90deg);
    }

    .toolbar-divider {
      width: 1px;
      height: 28px;
      background: linear-gradient(180deg, transparent 0%, #e2e8f0 50%, transparent 100%);
      margin: 0 6px;
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
  console.log('[MeiTrans] Content script loaded!')

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
