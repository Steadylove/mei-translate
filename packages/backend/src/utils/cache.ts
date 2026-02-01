/**
 * Cloudflare KV Cache utilities
 */

import type { Env } from '../types'
import { generateCacheKey } from './hash'

// Cache TTL: 7 days
const CACHE_TTL = 60 * 60 * 24 * 7

export interface CachedTranslation {
  translatedText: string
  sourceLang: string
  targetLang: string
  model: string
  cachedAt: string
}

/**
 * Get translation from cache
 */
export async function getCachedTranslation(
  env: Env,
  text: string,
  sourceLang: string,
  targetLang: string,
  contextType?: string
): Promise<CachedTranslation | null> {
  try {
    const key = await generateCacheKey(text, sourceLang, targetLang, contextType)
    const cached = await env.TRANSLATION_CACHE.get(key, 'json')
    return cached as CachedTranslation | null
  } catch (error) {
    console.error('Cache read error:', error)
    return null
  }
}

/**
 * Save translation to cache
 */
export async function setCachedTranslation(
  env: Env,
  text: string,
  sourceLang: string,
  targetLang: string,
  translatedText: string,
  model: string,
  contextType?: string
): Promise<void> {
  try {
    const key = await generateCacheKey(text, sourceLang, targetLang, contextType)
    const value: CachedTranslation = {
      translatedText,
      sourceLang,
      targetLang,
      model,
      cachedAt: new Date().toISOString(),
    }
    await env.TRANSLATION_CACHE.put(key, JSON.stringify(value), {
      expirationTtl: CACHE_TTL,
    })
  } catch (error) {
    console.error('Cache write error:', error)
  }
}

/**
 * Batch get from cache
 */
export async function getBatchCached(
  env: Env,
  texts: string[],
  sourceLang: string,
  targetLang: string,
  contextType?: string
): Promise<Map<string, CachedTranslation>> {
  const results = new Map<string, CachedTranslation>()

  // Fetch all in parallel
  const promises = texts.map(async (text) => {
    const cached = await getCachedTranslation(env, text, sourceLang, targetLang, contextType)
    if (cached) {
      results.set(text, cached)
    }
  })

  await Promise.all(promises)
  return results
}

/**
 * Clear cache (for debugging)
 */
export async function clearCache(env: Env, prefix?: string): Promise<number> {
  // KV doesn't support prefix deletion directly
  // This would need to be implemented with list + delete
  // For now, just return 0
  console.log('Cache clear requested with prefix:', prefix)
  return 0
}
