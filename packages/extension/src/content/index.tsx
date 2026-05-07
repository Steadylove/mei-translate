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
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

    :host {
      all: initial;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .translator-root {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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
      width: 36px;
      height: 36px;
      background: #ffffff;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      pointer-events: auto;
      overflow: hidden;
      box-shadow:
        0 6px 18px rgba(15, 23, 42, 0.14),
        0 0 0 2px rgba(255, 255, 255, 0.92),
        0 0 0 4px rgba(13, 148, 136, 0.14),
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
        0 10px 30px rgba(15, 23, 42, 0.18),
        0 0 0 2px rgba(255, 255, 255, 0.95),
        0 0 0 5px rgba(13, 148, 136, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.25);
    }

    .trans-button:active {
      transform: scale(0.95);
      transition-duration: 0.1s;
    }

    .trans-button-icon {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 50%;
      object-fit: cover;
      user-select: none;
      -webkit-user-drag: none;
    }

    /* Result Panel */
    .result-panel {
      position: absolute;
      min-width: 280px;
      max-width: 360px;
      max-height: 400px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 18px;
      box-shadow:
        0 18px 52px rgba(15, 23, 42, 0.16),
        0 8px 24px rgba(15, 23, 42, 0.08);
      pointer-events: auto;
      overflow: hidden;
      animation: panelSlide 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      transition: max-height 0.35s ease;
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
      background: #ffffff;
      border-bottom: 1px solid rgba(226, 232, 240, 0.9);
      cursor: grab;
      user-select: none;
      transition: background 0.2s ease;
    }

    .result-header:hover {
      background: #f8fafc;
    }

    .result-header:active,
    .result-header.dragging {
      cursor: grabbing;
      background: #f1f5f9;
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
      color: #0f3f3c;
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
      box-shadow: 0 0 8px rgba(13, 148, 136, 0.24);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(13, 148, 136, 0.24); }
      50% { opacity: 0.75; box-shadow: 0 0 16px rgba(13, 148, 136, 0.34); }
    }

    .result-close {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: rgba(13, 148, 136, 0.12);
      cursor: pointer;
      border-radius: 6px;
      color: #0f766e;
      transition: all 0.2s ease;
    }

    .result-close:hover {
      background: rgba(13, 148, 136, 0.14);
      color: #0f766e;
      transform: rotate(90deg);
    }

    .result-content {
      padding: 14px;
      max-height: 340px;
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

    .result-actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    .result-copy,
    .result-speak {
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

    .result-copy:hover,
    .result-speak:hover {
      background: #e2e8f0;
      color: #0d9488;
      transform: scale(1.1);
    }

    .result-speak.speaking {
      color: #0d9488;
      animation: speakPulse 1s ease-in-out infinite;
    }

    @keyframes speakPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.1); }
    }

    .result-original {
      font-size: 12px;
      color: #334155;
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
      background: #f0fdfa;
      border-radius: 10px;
      border: 1px solid #5eead4;
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
      background: #ecfdf5;
      border: 1px solid #86efac;
    }

    .result-llm:hover {
      border-color: #34d399;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.1);
    }

    .result-hint {
      display: flex;
      align-items: flex-start;
      gap: 8px;
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

    /* Refine Modal (full-screen centered overlay) */
    .refine-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      z-index: 10;
      animation: overlayFadeIn 0.25s ease;
    }

    @keyframes overlayFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .refine-modal {
      width: 680px;
      max-width: 92vw;
      max-height: 85vh;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border-radius: 18px;
      box-shadow:
        0 24px 80px rgba(0, 0, 0, 0.2),
        0 0 0 1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: modalSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: scale(0.92) translateY(20px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    .refine-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: #0f766e;
      flex-shrink: 0;
    }

    .refine-modal-title {
      font-weight: 600;
      font-size: 14px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.01em;
    }

    .refine-modal-close {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: rgba(255, 255, 255, 0.15);
      cursor: pointer;
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.8);
      transition: all 0.2s ease;
    }

    .refine-modal-close:hover {
      background: rgba(255, 255, 255, 0.25);
      color: #ffffff;
      transform: rotate(90deg);
    }

    .refine-modal-body {
      padding: 18px;
      overflow-y: auto;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .refine-modal-body::-webkit-scrollbar {
      width: 5px;
    }

    .refine-modal-body::-webkit-scrollbar-track {
      background: transparent;
    }

    .refine-modal-body::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }

    /* Two-column context area */
    .refine-context {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .refine-context-col {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .refine-context-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }

    .refine-context-label-ai {
      color: #0d9488;
    }

    .refine-context-text {
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
      padding: 10px 12px;
      background: #f1f5f9;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      flex: 1;
    }

    .refine-context-text-ai {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border-color: #a7f3d0;
      color: #0f172a;
    }

    /* Presets row with label */
    .refine-presets-row {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .refine-presets-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }

    /* Chat area */
    .refine-chat-area {
      flex: 1;
      min-height: 80px;
      max-height: 240px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #fafbfc;
    }

    .refine-chat-area::-webkit-scrollbar {
      width: 4px;
    }

    .refine-chat-area::-webkit-scrollbar-track {
      background: transparent;
    }

    .refine-chat-area::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 2px;
    }

    .refine-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 28px;
      color: #94a3b8;
      font-size: 12px;
      text-align: center;
    }

    /* Refine Translation UI */
    .refine-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 8px 12px;
      margin-top: 10px;
      background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%);
      border: 1px dashed #99f6e4;
      border-radius: 10px;
      cursor: pointer;
      color: #0d9488;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      transition: all 0.25s ease;
    }

    .refine-toggle:hover {
      background: linear-gradient(135deg, #ccfbf1 0%, #d1fae5 100%);
      border-color: #5eead4;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(13, 148, 136, 0.12);
    }

    .refine-toggle:active {
      transform: scale(0.98);
    }

    .refine-toggle.active {
      background: #0f766e;
      color: white;
      border: 1px solid transparent;
      box-shadow: 0 4px 14px rgba(13, 148, 136, 0.3);
    }

    .refine-panel {
      margin-top: 10px;
      animation: refinePanelSlide 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }

    @keyframes refinePanelSlide {
      from {
        opacity: 0;
        max-height: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        max-height: 500px;
        transform: translateY(0);
      }
    }

    .refine-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 10px;
    }

    .refine-preset-btn {
      padding: 5px 10px;
      font-size: 10px;
      font-weight: 600;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .refine-preset-btn:hover {
      background: linear-gradient(135deg, #f0fdfa, #ecfdf5);
      border-color: #99f6e4;
      color: #0d9488;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(13, 148, 136, 0.1);
    }

    .refine-preset-btn:active {
      transform: scale(0.95);
    }

    .refine-preset-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .refine-messages {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
    }

    .refine-msg {
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 12px;
      line-height: 1.5;
      animation: sectionFade 0.3s ease-out;
    }

    .refine-msg-user {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      align-self: flex-end;
      max-width: 90%;
    }

    .refine-msg-user::before {
      content: '';
      display: inline-block;
      width: 6px;
      height: 6px;
      margin-right: 6px;
      border-radius: 50%;
      background: #14b8a6;
      font-size: 10px;
    }

    .refine-msg-ai {
      background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
      border: 1px solid #a7f3d0;
      color: #0f172a;
      position: relative;
    }

    .refine-msg-ai-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .refine-msg-ai-label {
      font-size: 9px;
      font-weight: 600;
      color: #10b981;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .refine-adopt-btn {
      padding: 2px 8px;
      font-size: 9px;
      font-weight: 600;
      color: #0d9488;
      background: rgba(13, 148, 136, 0.1);
      border: 1px solid rgba(13, 148, 136, 0.2);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .refine-adopt-btn:hover {
      background: #0d9488;
      color: white;
      border-color: #0d9488;
    }

    .refine-adopt-btn.adopted {
      background: #10b981;
      color: white;
      border-color: #10b981;
    }

    .refine-input-area {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .refine-input {
      flex: 1;
      padding: 10px 14px;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: white;
      color: #0f172a;
      outline: none;
      transition: all 0.2s ease;
      font-family: inherit;
    }

    .refine-input:focus {
      border-color: #0d9488;
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.1);
    }

    .refine-input::placeholder {
      color: #94a3b8;
    }

    .refine-send-btn {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f766e;
      border: none;
      border-radius: 12px;
      cursor: pointer;
      color: white;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }

    .refine-send-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(13, 148, 136, 0.3);
    }

    .refine-send-btn:active {
      transform: scale(0.95);
    }

    .refine-send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .refine-loading {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 10px;
      background: #f8fafc;
      border-radius: 10px;
      color: #64748b;
      font-size: 11px;
      animation: sectionFade 0.3s ease-out;
    }

    .refine-error {
      padding: 6px 10px;
      background: #fef2f2;
      border-radius: 8px;
      color: #dc2626;
      font-size: 11px;
      border: 1px solid #fecaca;
      margin-bottom: 8px;
    }

    .refine-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent 0%, #e2e8f0 50%, transparent 100%);
      margin: 10px 0;
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
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(148, 163, 184, 0.32);
      border-radius: 22px;
      box-shadow:
        0 14px 44px rgba(15, 23, 42, 0.14),
        0 0 0 1px rgba(255, 255, 255, 0.9);
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
      border: 1px solid #cbd5e1;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 600;
      background: rgba(255,255,255,0.9) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230f766e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;
      cursor: pointer;
      color: #0f172a;
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
      border-radius: 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .webtrans-toolbar .btn-primary {
      background: #0f766e;
      color: white;
      box-shadow: 0 6px 18px rgba(15, 118, 110, 0.24);
    }

    .webtrans-toolbar .btn-primary:hover {
      box-shadow: 0 8px 22px rgba(15, 118, 110, 0.28);
      transform: translateY(-2px);
    }

    .webtrans-toolbar .btn-primary:active {
      transform: translateY(0);
    }

    .webtrans-toolbar .btn-secondary {
      background: rgba(255, 255, 255, 0.92);
      color: #334155;
      border: 1px solid rgba(13, 148, 136, 0.24);
    }

    .webtrans-toolbar .btn-secondary:hover {
      background: #ecfeff;
      color: #0f766e;
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
  console.log('[Mei Lingua] Content script loaded!')

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
