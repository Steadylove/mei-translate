/**
 * Text hashing utilities for cache keys
 */

/**
 * Generate a hash for text content using Web Crypto API
 */
export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a cache key for translation
 */
export async function generateCacheKey(
  text: string,
  sourceLang: string,
  targetLang: string,
  contextType?: string
): Promise<string> {
  const combined = `${text}|${sourceLang}|${targetLang}|${contextType || 'general'}`
  const hash = await hashText(combined)
  return `trans:${sourceLang}:${targetLang}:${hash.substring(0, 16)}`
}

/**
 * Generate a simpler hash for quick lookups
 */
export function simpleHash(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}
