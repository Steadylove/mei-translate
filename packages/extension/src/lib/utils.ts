import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if text contains only numbers
 */
export function isAllNumber(text: string): boolean {
  return /^\d+$/.test(text.trim())
}

/**
 * Check if text contains only punctuation
 */
export function isAllPunctuation(text: string): boolean {
  return /^[\s\p{P}]+$/u.test(text.trim())
}

/**
 * Check if we're in the top frame
 */
export function isTopFrame(): boolean {
  try {
    return window.self === window.top
  } catch {
    return false
  }
}

/**
 * Get current page host
 */
export function getHost(): string {
  return window.location.host
}

/**
 * Detect if text is primarily Chinese
 */
export function isChinese(text: string): boolean {
  const chineseRegex = /[\u4e00-\u9fa5]/g
  const matches = text.match(chineseRegex)
  return matches ? matches.length > text.length * 0.3 : false
}

/**
 * Get target language based on source
 */
export function getTargetLanguage(sourceLang: string, defaultTarget: string): string {
  if (sourceLang === 'zh' && defaultTarget === 'zh') {
    return 'en'
  }
  if (sourceLang === 'en' && defaultTarget === 'en') {
    return 'zh'
  }
  return defaultTarget
}
