/**
 * Web Page Translation Module
 * Handles DOM traversal, node cloning, and batch translation for entire pages
 */

import { requestWebPageTranslation } from '@/services/translate'

// Display modes
export enum DisplayMode {
  ORIGIN = 1,
  TRANSLATE = 2,
  COMPARISON = 3,
}

// Configuration
const MAX_TEXT_LENGTH = 2500
const MAX_BATCH_SIZE = 50
const TRANSLATION_DELAY = 100

// State
let isInitialized = false
let isTranslating = false
let currentDisplayMode = DisplayMode.COMPARISON
let targetLanguage = 'zh'
let sourceLanguage = 'detect'
let styleNode: HTMLStyleElement | null = null
let baseStyleNode: HTMLStyleElement | null = null

// Node name sets for filtering
const IGNORE_NODE_NAMES = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'IFRAME',
  'CANVAS',
  'SVG',
  'VIDEO',
  'AUDIO',
  'CODE',
  'PRE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'MATH',
  'TEMPLATE',
  'SLOT',
])

const BLOCK_DISPLAY = new Set(['block', 'flex', 'grid', 'table', 'list-item', 'flow-root'])

/**
 * Initialize the web translation module
 */
export function initWebTranslation() {
  if (isInitialized) return
  isInitialized = true
  initStyles()
}

/**
 * Initialize style nodes for showing/hiding translations
 */
function initStyles() {
  baseStyleNode = document.createElement('style')
  baseStyleNode.textContent = `
    [data-wt-status="loading"]::after {
      content: '';
      display: inline-block;
      width: 1em;
      height: 1em;
      margin-left: 4px;
      border: 2px solid rgba(0,0,0,0.2);
      border-top-color: rgba(0,0,0,0.6);
      border-radius: 50%;
      animation: wt-spin 0.6s linear infinite;
      vertical-align: middle;
    }
    @keyframes wt-spin {
      to { transform: rotate(360deg); }
    }
    [data-wt-trans] {
      background: linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%);
    }
  `
  document.head.appendChild(baseStyleNode)

  styleNode = document.createElement('style')
  document.head.appendChild(styleNode)
  updateDisplayStyles()
}

/**
 * Update display styles based on current mode
 */
function updateDisplayStyles() {
  if (!styleNode) return

  const hideOrigin = currentDisplayMode === DisplayMode.TRANSLATE
  const hideTranslate = currentDisplayMode === DisplayMode.ORIGIN

  styleNode.textContent = `
    ${hideOrigin ? '[data-wt-origin] { display: none !important; }' : ''}
    ${hideTranslate ? '[data-wt-trans] { display: none !important; }' : ''}
  `
}

/**
 * Set the display mode
 */
export function setDisplayMode(mode: DisplayMode) {
  currentDisplayMode = mode
  updateDisplayStyles()
}

/**
 * Get current display mode
 */
export function getDisplayMode(): DisplayMode {
  return currentDisplayMode
}

/**
 * Set target language
 */
export function setTargetLanguage(lang: string) {
  targetLanguage = lang
}

/**
 * Set source language
 */
export function setSourceLanguage(lang: string) {
  sourceLanguage = lang
}

/**
 * Check if a node should be translated
 */
function shouldTranslateNode(node: Node): boolean {
  if (!(node instanceof Element)) return true

  const nodeName = node.nodeName.toUpperCase()
  if (IGNORE_NODE_NAMES.has(nodeName)) return false
  if (node.classList.contains('notranslate')) return false
  if ((node as HTMLElement).isContentEditable) return false
  if (node.getAttribute('translate') === 'no') return false

  return true
}

/**
 * Check if node is a block element
 */
function isBlockNode(node: Node): boolean {
  if (!(node instanceof Element)) return false
  const display = getComputedStyle(node).display.split(' ')[0]
  return BLOCK_DISPLAY.has(display)
}

/**
 * Get text content of a node (excluding nested blocks)
 */
function getNodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.trim() || ''
  }

  if (!(node instanceof Element)) return ''

  // For inline elements, get all text
  if (!isBlockNode(node)) {
    return node.textContent?.trim() || ''
  }

  // For block elements, only get direct text
  let text = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || ''
    }
  }
  return text.trim()
}

/**
 * Collect translatable text nodes from the page
 */
function collectTextNodes(root: Element = document.body): Array<{ node: Element; text: string }> {
  const results: Array<{ node: Element; text: string }> = []

  function traverse(node: Node) {
    if (!shouldTranslateNode(node)) return

    if (node instanceof Element) {
      // Skip if already translated
      if (node.hasAttribute('data-wt-origin') || node.hasAttribute('data-wt-trans')) {
        return
      }

      const text = getNodeText(node)
      if (text && text.length > 1) {
        // Only add if it's a leaf block or has substantial text
        const hasBlockChildren = Array.from(node.children).some(isBlockNode)

        if (!hasBlockChildren && isBlockNode(node)) {
          results.push({ node, text })
        } else if (!isBlockNode(node) && !hasBlockChildren) {
          // Inline element with text
          const parent = node.parentElement
          if (parent && isBlockNode(parent)) {
            // Let the parent handle it
          } else {
            results.push({ node, text })
          }
        }
      }

      // Traverse children
      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  traverse(root)
  return results
}

/**
 * Create translation node
 */
function createTranslationNode(original: Element, translatedText: string): Element {
  const clone = original.cloneNode(false) as Element
  clone.textContent = translatedText
  clone.setAttribute('data-wt-trans', 'true')
  clone.removeAttribute('data-wt-status')

  // Copy essential styles
  const style = (clone as HTMLElement).style
  style.cssText = ''

  return clone
}

/**
 * Start web page translation
 */
export async function startWebTranslation(): Promise<void> {
  if (isTranslating) return
  isTranslating = true

  try {
    // Collect text nodes
    const textNodes = collectTextNodes()

    if (textNodes.length === 0) {
      console.log('No translatable text found')
      return
    }

    // Mark nodes as loading
    for (const { node } of textNodes) {
      node.setAttribute('data-wt-origin', 'true')
      node.setAttribute('data-wt-status', 'loading')
    }

    // Batch translate
    const batches: Array<Array<{ node: Element; text: string }>> = []
    let currentBatch: Array<{ node: Element; text: string }> = []
    let currentLength = 0

    for (const item of textNodes) {
      if (
        currentLength + item.text.length > MAX_TEXT_LENGTH ||
        currentBatch.length >= MAX_BATCH_SIZE
      ) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch)
        }
        currentBatch = []
        currentLength = 0
      }
      currentBatch.push(item)
      currentLength += item.text.length
    }

    if (currentBatch.length > 0) {
      batches.push(currentBatch)
    }

    // Process batches
    for (const batch of batches) {
      if (!isTranslating) break

      const texts = batch.map((item) => item.text)

      try {
        const result = await requestWebPageTranslation(texts, sourceLanguage, targetLanguage)

        // Insert translations
        for (let i = 0; i < batch.length; i++) {
          const { node } = batch[i]
          const translatedText = result.translations[i]

          if (translatedText && document.body.contains(node)) {
            node.removeAttribute('data-wt-status')

            // Create and insert translation node
            const transNode = createTranslationNode(node, translatedText)
            node.parentNode?.insertBefore(transNode, node.nextSibling)
          }
        }
      } catch (err) {
        console.error('Batch translation failed:', err)
        // Remove loading state on error
        for (const { node } of batch) {
          node.removeAttribute('data-wt-status')
        }
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, TRANSLATION_DELAY))
    }
  } finally {
    isTranslating = false
  }
}

/**
 * Stop and reset web page translation
 */
export function stopWebTranslation(): void {
  isTranslating = false

  // Remove all translation nodes
  const transNodes = document.querySelectorAll('[data-wt-trans]')
  transNodes.forEach((node) => node.remove())

  // Reset original nodes
  const origNodes = document.querySelectorAll('[data-wt-origin]')
  origNodes.forEach((node) => {
    node.removeAttribute('data-wt-origin')
    node.removeAttribute('data-wt-status')
  })

  // Reset display mode
  currentDisplayMode = DisplayMode.COMPARISON
  updateDisplayStyles()
}

/**
 * Check if translation is in progress
 */
export function isTranslationInProgress(): boolean {
  return isTranslating
}

export default {
  initWebTranslation,
  startWebTranslation,
  stopWebTranslation,
  setDisplayMode,
  getDisplayMode,
  setTargetLanguage,
  setSourceLanguage,
  isTranslationInProgress,
  DisplayMode,
}
