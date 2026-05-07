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

type TranslationStatus = 'idle' | 'translating'
type StatusListener = (status: TranslationStatus) => void

// Configuration
const MAX_TEXT_LENGTH = 2500
const MAX_BATCH_SIZE = 50
const TRANSLATION_DELAY = 100
const VIEWPORT_MARGIN = 300
const SCHEDULE_DELAY = 160
const MAX_BLOCK_TEXT_LENGTH = 2500

// State
let isInitialized = false
let isActive = false
let isTranslating = false
let pendingScan = false
let currentDisplayMode = DisplayMode.COMPARISON
let targetLanguage = 'zh'
let sourceLanguage: string | undefined
let styleNode: HTMLStyleElement | null = null
let baseStyleNode: HTMLStyleElement | null = null
let mutationObserver: MutationObserver | null = null
let scheduleTimer: number | null = null
const statusListeners = new Set<StatusListener>()

function notifyStatus(status: TranslationStatus): void {
  statusListeners.forEach((listener) => listener(status))
}

export function subscribeTranslationStatus(listener: StatusListener): () => void {
  statusListeners.add(listener)
  listener(isTranslating ? 'translating' : 'idle')

  return () => {
    statusListeners.delete(listener)
  }
}

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
  'WEB-TRANSLATOR-EXT',
])

const BLOCK_DISPLAY = new Set(['block', 'flex', 'grid', 'table', 'list-item', 'flow-root'])
const SKIP_READABLE_TEXT_NAMES = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'BUTTON',
  'SVG',
  'CANVAS',
  'VIDEO',
  'AUDIO',
])
const CHILD_FIRST_NODE_NAMES = new Set([
  'BODY',
  'HTML',
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TD',
  'TH',
  'UL',
  'OL',
  'DL',
])
const SEMANTIC_COPY_NODE_NAMES = new Set([
  'P',
  'LI',
  'TD',
  'TH',
  'DT',
  'DD',
  'BLOCKQUOTE',
  'FIGCAPTION',
  'SUMMARY',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
])
const SEMANTIC_COPY_SELECTOR = Array.from(SEMANTIC_COPY_NODE_NAMES)
  .map((name) => name.toLowerCase())
  .join(',')

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
      color: inherit;
      opacity: 0.86;
      word-break: normal;
      overflow-wrap: break-word;
      background: linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.05) 50%, transparent 100%);
    }
    [data-wt-trans][data-wt-inline="true"] {
      display: inline;
      margin-left: 0.35em;
    }
    [data-wt-origin-content] {
      display: contents;
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
    ${
      hideOrigin
        ? `
          [data-wt-origin][data-wt-has-trans="true"]:not([data-wt-placement="inside"]) { display: none !important; }
          [data-wt-origin][data-wt-placement="inside"] > [data-wt-origin-content] { display: none !important; }
        `
        : ''
    }
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
  if (node.closest('web-translator-ext')) return false
  if (node.classList.contains('notranslate')) return false
  if ((node as HTMLElement).isContentEditable) return false
  if (node.getAttribute('translate') === 'no') return false

  return true
}

function isAlreadyHandled(node: Element): boolean {
  return !!node.closest('[data-wt-origin], [data-wt-trans]')
}

function hasTranslationSibling(node: Element): boolean {
  return (
    node.nextElementSibling?.hasAttribute('data-wt-trans') ||
    Array.from(node.children).some((child) => child.hasAttribute('data-wt-trans'))
  )
}

/**
 * Check if node is a block element
 */
function isBlockNode(node: Node): boolean {
  if (!(node instanceof Element)) return false
  const display = getComputedStyle(node).display.split(' ')[0]
  return BLOCK_DISPLAY.has(display)
}

function normalizeReadableText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function getReadableText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || ''
  }

  if (!(node instanceof Element)) return ''
  if (!shouldTranslateNode(node)) return ''

  const nodeName = node.nodeName.toUpperCase()
  if (SKIP_READABLE_TEXT_NAMES.has(nodeName)) return ''

  const parts: string[] = []
  for (const child of node.childNodes) {
    const childText = getReadableText(child)
    if (childText) {
      parts.push(childText)
    }
  }

  return parts.join(' ')
}

function isValidParagraphText(text: string): boolean {
  const normalized = normalizeReadableText(text)
  if (normalized.length <= 1) return false
  if (normalized.length > MAX_BLOCK_TEXT_LENGTH) return false
  if (isLikelyTechnicalText(normalized)) return false
  if (!/[A-Za-z\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\u0400-\u04ff]/.test(normalized)) {
    return false
  }
  return true
}

function isLikelyTechnicalToken(token: string): boolean {
  const trimmed = token.trim()
  if (trimmed.length <= 1) return false
  if (/^#?\d+$/.test(trimmed)) return true
  if (/^[a-f0-9]{7,40}$/i.test(trimmed)) return true
  if (/^https?:\/\//i.test(trimmed)) return true
  if (/^@?[\w.-]+\/[\w.-]+$/.test(trimmed)) return true
  if (/^[\w.-]+\[[^\]]+\]$/.test(trimmed)) return true
  if (/^[\w.-]+@[\w.-]+$/.test(trimmed)) return true

  return trimmed.length >= 8 && /^[#@]?[\w.[\]/:-]+$/.test(trimmed) && /[-_./:[\]@]/.test(trimmed)
}

function isLikelyTechnicalText(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  if (tokens.length === 1) {
    return isLikelyTechnicalToken(tokens[0])
  }

  const technicalTokens = tokens.filter(isLikelyTechnicalToken).length
  return technicalTokens / tokens.length >= 0.65
}

function isDenseNarrowContainer(node: Element): boolean {
  if (node.children.length < 2) return false

  const rect = node.getBoundingClientRect()
  if (rect.width === 0 || rect.width > 220) return false

  const text = normalizeReadableText(getReadableText(node))
  return text.length > 24
}

function getDisplayType(node: Element): string {
  return getComputedStyle(node).display.split(' ')[0]
}

function isLayoutSensitiveParent(node: Element): boolean {
  const parent = node.parentElement
  if (!parent) return false

  const parentName = parent.nodeName.toUpperCase()
  if (['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'UL', 'OL', 'DL'].includes(parentName)) return true

  const display = getDisplayType(parent)
  return [
    'flex',
    'grid',
    'table',
    'table-row',
    'table-row-group',
    'table-header-group',
    'table-footer-group',
    'list-item',
  ].includes(display)
}

function shouldPlaceTranslationInside(node: Element): boolean {
  const nodeName = node.nodeName.toUpperCase()
  if (['LI', 'TD', 'TH', 'DT', 'DD'].includes(nodeName)) return true
  return !SEMANTIC_COPY_NODE_NAMES.has(nodeName) && isLayoutSensitiveParent(node)
}

/**
 * Check whether the node is currently visible or close enough to the viewport.
 */
function isNearViewport(node: Element): boolean {
  const rects = Array.from(node.getClientRects())
  if (rects.length === 0) return false

  return rects.some(
    (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= -VIEWPORT_MARGIN &&
      rect.top <= window.innerHeight + VIEWPORT_MARGIN &&
      rect.right >= -VIEWPORT_MARGIN &&
      rect.left <= window.innerWidth + VIEWPORT_MARGIN
  )
}

/**
 * Sort candidates so the visible area is translated before below-the-fold content.
 */
function sortByViewportPriority(
  items: Array<{ node: Element; text: string }>
): Array<{ node: Element; text: string }> {
  const viewportCenter = window.innerHeight / 2

  return items.sort((a, b) => {
    const aRect = a.node.getBoundingClientRect()
    const bRect = b.node.getBoundingClientRect()
    const aDistance = Math.abs(aRect.top + aRect.height / 2 - viewportCenter)
    const bDistance = Math.abs(bRect.top + bRect.height / 2 - viewportCenter)
    return aDistance - bDistance
  })
}

/**
 * Collect translatable text nodes from the page
 */
function collectTextNodes(
  root: Element = document.body,
  viewportOnly = false
): Array<{ node: Element; text: string }> {
  const results: Array<{ node: Element; text: string }> = []
  const resultNodes = new Set<Element>()

  function hasCollectedAncestor(node: Element): boolean {
    let parent = node.parentElement

    while (parent && parent !== root.parentElement) {
      if (resultNodes.has(parent)) return true
      parent = parent.parentElement
    }

    return false
  }

  function addResult(node: Element, text: string): void {
    if (resultNodes.has(node) || hasCollectedAncestor(node)) return
    results.push({ node, text })
    resultNodes.add(node)
  }

  function traverse(node: Node) {
    if (!shouldTranslateNode(node)) return

    if (node instanceof Element) {
      if (isAlreadyHandled(node)) return
      if (viewportOnly && !isNearViewport(node)) return

      const nodeName = node.nodeName.toUpperCase()
      const text = normalizeReadableText(getReadableText(node))
      const childElements = Array.from(node.children).filter(shouldTranslateNode)
      const isSemanticCopyNode = SEMANTIC_COPY_NODE_NAMES.has(nodeName)
      const isLeafTextNode = childElements.length === 0
      const shouldCopySelf =
        !CHILD_FIRST_NODE_NAMES.has(nodeName) &&
        isValidParagraphText(text) &&
        !hasTranslationSibling(node) &&
        !isDenseNarrowContainer(node) &&
        (isSemanticCopyNode || isLeafTextNode)

      if (shouldCopySelf) {
        addResult(node, text)
        return
      }

      for (const child of node.children) {
        traverse(child)
      }
    }
  }

  traverse(root)

  Array.from(root.querySelectorAll(SEMANTIC_COPY_SELECTOR)).forEach((node) => {
    if (!(node instanceof Element)) return
    if (!shouldTranslateNode(node)) return
    if (isAlreadyHandled(node) || hasTranslationSibling(node)) return
    if (viewportOnly && !isNearViewport(node)) return
    if (isDenseNarrowContainer(node)) return

    const text = normalizeReadableText(getReadableText(node))
    if (!isValidParagraphText(text)) return

    addResult(node, text)
  })

  return sortByViewportPriority(results)
}

/**
 * Create translation node
 */
function createTranslationNode(original: Element, translatedText: string): Element {
  const transNode = original.cloneNode(false) as Element
  transNode.textContent = translatedText
  transNode.setAttribute('data-wt-trans', 'true')
  transNode.removeAttribute('data-wt-origin')
  transNode.removeAttribute('data-wt-has-trans')
  transNode.removeAttribute('data-wt-status')
  transNode.removeAttribute('id')

  if (!isBlockNode(original)) {
    const style = (transNode as HTMLElement).style
    style.display = 'inline'
    style.marginLeft = '0.35em'
  }

  return transNode
}

function createInlineTranslationNode(translatedText: string): Element {
  const transNode = document.createElement('span')
  transNode.textContent = translatedText
  transNode.setAttribute('data-wt-trans', 'true')
  transNode.setAttribute('data-wt-inline', 'true')
  return transNode
}

function wrapOriginalContent(original: Element): void {
  if (Array.from(original.children).some((child) => child.hasAttribute('data-wt-origin-content')))
    return

  const wrapper = document.createElement('span')
  wrapper.setAttribute('data-wt-origin-content', 'true')

  while (original.firstChild) {
    wrapper.appendChild(original.firstChild)
  }

  original.appendChild(wrapper)
}

function clearIncompleteOriginMarks(): void {
  document.querySelectorAll('[data-wt-origin]:not([data-wt-has-trans="true"])').forEach((node) => {
    node.removeAttribute('data-wt-origin')
    node.removeAttribute('data-wt-status')
    node.removeAttribute('data-wt-placement')
  })
}

/**
 * Translate a small set of currently visible nodes.
 */
async function translateVisibleNodes(): Promise<void> {
  if (!isActive) return
  if (isTranslating) {
    pendingScan = true
    return
  }

  const textNodes = collectTextNodes(document.body, true)
  if (textNodes.length === 0) return

  isTranslating = true
  notifyStatus('translating')

  try {
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

          node.removeAttribute('data-wt-status')

          if (!isActive || !document.body.contains(node)) continue

          if (!translatedText) {
            node.removeAttribute('data-wt-origin')
            continue
          }

          if (hasTranslationSibling(node)) {
            node.setAttribute('data-wt-has-trans', 'true')
            continue
          }

          if (shouldPlaceTranslationInside(node)) {
            wrapOriginalContent(node)
            node.appendChild(createInlineTranslationNode(translatedText))
            node.setAttribute('data-wt-placement', 'inside')
          } else {
            const transNode = createTranslationNode(node, translatedText)
            node.parentNode?.insertBefore(transNode, node.nextSibling)
          }
          node.setAttribute('data-wt-has-trans', 'true')
        }
      } catch (err) {
        console.error('Batch translation failed:', err)
        // Remove loading state on error
        for (const { node } of batch) {
          node.removeAttribute('data-wt-origin')
          node.removeAttribute('data-wt-status')
        }
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, TRANSLATION_DELAY))
    }
  } finally {
    isTranslating = false
    notifyStatus('idle')

    if (pendingScan && isActive) {
      pendingScan = false
      scheduleVisibleTranslation()
    }
  }
}

function scheduleVisibleTranslation(delay = SCHEDULE_DELAY): void {
  if (!isActive) return

  if (scheduleTimer !== null) {
    window.clearTimeout(scheduleTimer)
  }

  scheduleTimer = window.setTimeout(() => {
    scheduleTimer = null
    translateVisibleNodes()
  }, delay)
}

function ensureLazyObservers(): void {
  window.removeEventListener('scroll', handleLazyTrigger, true)
  document.removeEventListener('scroll', handleLazyTrigger, true)
  window.removeEventListener('resize', handleLazyTrigger)
  window.addEventListener('scroll', handleLazyTrigger, true)
  document.addEventListener('scroll', handleLazyTrigger, true)
  window.addEventListener('resize', handleLazyTrigger)

  if (mutationObserver) {
    mutationObserver.disconnect()
  }

  mutationObserver = new MutationObserver((mutations) => {
    const hasAddedContent = mutations.some((mutation) =>
      Array.from(mutation.addedNodes).some((node) => {
        if (node.nodeType === Node.TEXT_NODE) return !!node.textContent?.trim()
        return (
          node instanceof Element &&
          !node.hasAttribute('data-wt-trans') &&
          !node.hasAttribute('data-wt-origin') &&
          shouldTranslateNode(node)
        )
      })
    )

    if (hasAddedContent) {
      scheduleVisibleTranslation()
    }
  })

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

function handleLazyTrigger(): void {
  scheduleVisibleTranslation()
}

/**
 * Start web page translation.
 * Translation is lazy: visible content is translated first, then scroll/new DOM triggers more work.
 */
export async function startWebTranslation(): Promise<void> {
  isActive = true
  clearIncompleteOriginMarks()
  ensureLazyObservers()
  await translateVisibleNodes()
  scheduleVisibleTranslation(800)
}

/**
 * Stop and reset web page translation
 */
export function stopWebTranslation(): void {
  isActive = false
  isTranslating = false
  notifyStatus('idle')
  pendingScan = false

  if (scheduleTimer !== null) {
    window.clearTimeout(scheduleTimer)
    scheduleTimer = null
  }

  window.removeEventListener('scroll', handleLazyTrigger, true)
  document.removeEventListener('scroll', handleLazyTrigger, true)
  window.removeEventListener('resize', handleLazyTrigger)

  if (mutationObserver) {
    mutationObserver.disconnect()
    mutationObserver = null
  }

  // Remove all translation nodes
  const transNodes = document.querySelectorAll('[data-wt-trans]')
  transNodes.forEach((node) => node.remove())

  const originContentNodes = document.querySelectorAll('[data-wt-origin-content]')
  originContentNodes.forEach((node) => {
    const parent = node.parentNode
    if (!parent) return

    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node)
    }

    node.remove()
  })

  // Reset original nodes
  const origNodes = document.querySelectorAll('[data-wt-origin]')
  origNodes.forEach((node) => {
    node.removeAttribute('data-wt-origin')
    node.removeAttribute('data-wt-has-trans')
    node.removeAttribute('data-wt-placement')
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
  subscribeTranslationStatus,
  DisplayMode,
}
