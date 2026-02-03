/**
 * Context Analysis Agent
 * Analyzes webpage content to determine context for better translations
 */

import type { Env, PageContext, ContextAnalysisResponse, ChatMessage, UserApiKeys } from '../types'
import { getProviderWithKey, getFirstAvailableProvider } from '../providers'
import { hashText } from '../utils/hash'

// Cache context analysis for 24 hours
const CONTEXT_CACHE_TTL = 60 * 60 * 24

/**
 * Analyze page content to determine context
 */
export async function analyzeContext(
  env: Env,
  content: string,
  apiKeys: UserApiKeys,
  url?: string,
  title?: string
): Promise<ContextAnalysisResponse> {
  // Check cache first
  if (url) {
    const cached = await getCachedContext(env, url)
    if (cached) {
      return cached
    }
  }

  // Check if user has API keys configured
  const available = getFirstAvailableProvider(apiKeys)
  if (!available) {
    // Return default context if no API key
    return {
      context: quickContextDetection(url, title) as PageContext,
      confidence: 0.5,
    }
  }

  // Limit content length for analysis
  const contentPreview = content.slice(0, 3000)

  const systemPrompt = `You are an expert content analyst. Analyze the following webpage content and determine its type, domain, and appropriate translation tone.

Return ONLY a valid JSON object with this exact structure:
{
  "type": "technical|news|academic|casual|legal|medical|general",
  "domain": "specific field or null",
  "tone": "formal|informal|neutral",
  "terminologyHints": ["key terms to watch for accurate translation"],
  "confidence": 0.0-1.0
}

Guidelines:
- technical: Programming, engineering, software documentation
- news: Current events, journalism, reports
- academic: Research papers, educational content, scientific articles
- casual: Blogs, social media, informal writing
- legal: Contracts, legal documents, terms of service
- medical: Healthcare, medical research, clinical content
- general: Everything else

The domain should be a specific field if applicable (e.g., "machine learning", "finance", "cooking").
Include 3-5 key terminology hints that would benefit from consistent translation.`

  const userPrompt = `${title ? `Title: ${title}\n` : ''}${url ? `URL: ${url}\n` : ''}\nContent:\n${contentPreview}`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  try {
    const provider = getProviderWithKey(available.provider, available.apiKey)
    const response = await provider.chat(messages, {
      temperature: 0.2,
      maxTokens: 500,
    })

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      type: PageContext['type']
      domain?: string
      tone: PageContext['tone']
      terminologyHints?: string[]
      confidence: number
    }

    const context: PageContext = {
      type: parsed.type || 'general',
      domain: parsed.domain || undefined,
      tone: parsed.tone || 'neutral',
      terminologyHints: parsed.terminologyHints || [],
      url,
      title,
    }

    const result: ContextAnalysisResponse = {
      context,
      confidence: parsed.confidence || 0.8,
    }

    // Cache the result
    if (url) {
      await cacheContext(env, url, result)
    }

    return result
  } catch (error) {
    console.error('Context analysis failed:', error)

    // Return default context on failure
    return {
      context: {
        type: 'general',
        tone: 'neutral',
        url,
        title,
      },
      confidence: 0,
    }
  }
}

/**
 * Quick context detection using heuristics (no LLM call)
 */
export function quickContextDetection(url?: string, title?: string): Partial<PageContext> {
  const urlLower = url?.toLowerCase() || ''
  const titleLower = title?.toLowerCase() || ''
  const combined = urlLower + ' ' + titleLower

  // Technical indicators
  if (
    combined.includes('github') ||
    combined.includes('stackoverflow') ||
    combined.includes('docs.') ||
    combined.includes('developer') ||
    combined.includes('api') ||
    combined.includes('documentation')
  ) {
    return { type: 'technical', tone: 'formal' }
  }

  // News indicators
  if (
    combined.includes('news') ||
    combined.includes('bbc') ||
    combined.includes('cnn') ||
    combined.includes('reuters') ||
    combined.includes('nytimes') ||
    combined.includes('article')
  ) {
    return { type: 'news', tone: 'formal' }
  }

  // Academic indicators
  if (
    combined.includes('arxiv') ||
    combined.includes('scholar') ||
    combined.includes('journal') ||
    combined.includes('research') ||
    combined.includes('.edu') ||
    combined.includes('paper')
  ) {
    return { type: 'academic', tone: 'formal' }
  }

  // Social/casual indicators
  if (
    combined.includes('twitter') ||
    combined.includes('reddit') ||
    combined.includes('facebook') ||
    combined.includes('instagram') ||
    combined.includes('blog')
  ) {
    return { type: 'casual', tone: 'informal' }
  }

  // Medical indicators
  if (
    combined.includes('medical') ||
    combined.includes('health') ||
    combined.includes('clinical') ||
    combined.includes('pubmed') ||
    combined.includes('medicine')
  ) {
    return { type: 'medical', tone: 'formal' }
  }

  // Legal indicators
  if (
    combined.includes('legal') ||
    combined.includes('terms') ||
    combined.includes('privacy') ||
    combined.includes('policy') ||
    combined.includes('agreement')
  ) {
    return { type: 'legal', tone: 'formal' }
  }

  return { type: 'general', tone: 'neutral' }
}

/**
 * Get cached context analysis
 */
async function getCachedContext(env: Env, url: string): Promise<ContextAnalysisResponse | null> {
  try {
    const urlHash = await hashText(url)

    const result = await env.DB.prepare(
      `
      SELECT context_type, domain, tone, terminology_hints, confidence
      FROM context_cache
      WHERE url_hash = ? AND expires_at > datetime('now')
      LIMIT 1
    `
    )
      .bind(urlHash)
      .first<{
        context_type: string
        domain: string | null
        tone: string
        terminology_hints: string | null
        confidence: number
      }>()

    if (!result) return null

    const context: PageContext = {
      type: result.context_type as PageContext['type'],
      domain: result.domain || undefined,
      tone: result.tone as PageContext['tone'],
      terminologyHints: result.terminology_hints ? JSON.parse(result.terminology_hints) : [],
      url,
    }

    return {
      context,
      confidence: result.confidence,
    }
  } catch (error) {
    console.error('Failed to get cached context:', error)
    return null
  }
}

/**
 * Cache context analysis
 */
async function cacheContext(
  env: Env,
  url: string,
  analysis: ContextAnalysisResponse
): Promise<void> {
  try {
    const urlHash = await hashText(url)
    const expiresAt = new Date(Date.now() + CONTEXT_CACHE_TTL * 1000).toISOString()

    await env.DB.prepare(
      `
      INSERT INTO context_cache
        (url_hash, url, context_type, domain, tone, terminology_hints, confidence, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(url_hash) DO UPDATE SET
        context_type = excluded.context_type,
        domain = excluded.domain,
        tone = excluded.tone,
        terminology_hints = excluded.terminology_hints,
        confidence = excluded.confidence,
        expires_at = excluded.expires_at
    `
    )
      .bind(
        urlHash,
        url,
        analysis.context.type,
        analysis.context.domain || null,
        analysis.context.tone,
        analysis.context.terminologyHints
          ? JSON.stringify(analysis.context.terminologyHints)
          : null,
        analysis.confidence,
        expiresAt
      )
      .run()
  } catch (error) {
    console.error('Failed to cache context:', error)
  }
}
