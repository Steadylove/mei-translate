/**
 * Translation Service
 * Connects to the AI Translation Agent backend
 * Includes user-configured API keys for LLM translation
 */

import Storage, { ModelProvider, UserApiKeys } from './storage'

// Backend API configuration - uses Vite's define or falls back to env check
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8787' : 'https://webtrans-api.your-domain.workers.dev')

export type { ModelProvider, UserApiKeys }

export interface PageContext {
  type: 'technical' | 'news' | 'academic' | 'casual' | 'legal' | 'medical' | 'general'
  domain?: string
  tone: 'formal' | 'informal' | 'neutral'
  terminologyHints?: string[]
  url?: string
  title?: string
}

export interface TranslateRequest {
  text: string
  sourceLanguage?: string
  targetLanguage: string
  context?: PageContext
  model?: ModelProvider
  modelId?: string
  useCache?: boolean
  useMemory?: boolean
}

export interface TranslateResponse {
  translatedText: string
  sourceLanguage: string
  targetLanguage: string
  model?: string
  cached?: boolean
}

export interface DualTranslateResponse {
  machine: {
    translatedText: string | null
    provider: string | null
    error?: string
  }
  llm: {
    translatedText: string | null
    model: string | null
    error?: string
    available: boolean
  }
  sourceLanguage: string
  targetLanguage: string
}

export interface BatchTranslateRequest {
  texts: string[]
  sourceLanguage?: string
  targetLanguage: string
  context?: PageContext
  model?: ModelProvider
}

export interface BatchTranslateResponse {
  translations: string[]
  sourceLanguage: string
  targetLanguage: string
  model?: string
  cachedCount?: number
}

export interface DetectLanguageResponse {
  language: string
  confidence: number
}

export interface SummaryResponse {
  summary: string
  summaryTranslated?: string
  keyPoints: string[]
  keyPointsTranslated?: string[]
  estimatedReadTime: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    cached?: boolean
    model?: string
    tokensUsed?: number
    processingTime?: number
  }
}

/**
 * Get user's API keys and selected model from storage
 */
async function getUserConfig(): Promise<{
  apiKeys: UserApiKeys
  provider: ModelProvider | null
  model: string | null
}> {
  const [apiKeys, { provider, model }] = await Promise.all([
    Storage.getApiKeys(),
    Storage.getSelectedModel(),
  ])
  return { apiKeys, provider, model }
}

/**
 * Make an API request to the backend
 */
async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: unknown
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`

  console.log(`[API] ${method} ${url}`)

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)
  const result = (await response.json()) as ApiResponse<T>

  if (!result.success) {
    throw new Error(result.error || 'API request failed')
  }

  return result.data as T
}

/**
 * Detect language of the given text
 */
export async function detectLanguage(text: string): Promise<DetectLanguageResponse> {
  try {
    const result = await apiRequest<{ language: string }>('/api/translate/detect', 'POST', { text })
    return { language: result.language, confidence: 0.9 }
  } catch (_error) {
    // Fallback to local detection
    const chineseRegex = /[\u4e00-\u9fa5]/g
    const matches = text.match(chineseRegex)
    const chineseRatio = matches ? matches.length / text.length : 0

    if (chineseRatio > 0.3) {
      return { language: 'zh', confidence: 0.9 }
    }
    return { language: 'en', confidence: 0.9 }
  }
}

/**
 * Translate a single text using user-configured API keys
 */
export async function translate(request: TranslateRequest): Promise<TranslateResponse> {
  const {
    text,
    targetLanguage,
    sourceLanguage,
    context,
    model,
    modelId,
    useCache = true,
    useMemory = true,
  } = request

  // Get user's API keys
  const { apiKeys, provider, model: selectedModel } = await getUserConfig()

  try {
    const result = await apiRequest<{
      translatedText: string
      sourceLang: string
      targetLang: string
      model: string
      cached: boolean
    }>('/api/translate', 'POST', {
      text,
      targetLang: targetLanguage,
      sourceLang: sourceLanguage,
      context,
      model: model || provider,
      modelId: modelId || selectedModel,
      apiKeys,
      useCache,
      useMemory,
    })

    return {
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLang,
      targetLanguage: result.targetLang,
      model: result.model,
      cached: result.cached,
    }
  } catch (error) {
    console.error('Translation API error:', error)
    // Return fallback mock translation
    return {
      translatedText: `[Translation pending] ${text}`,
      sourceLanguage: sourceLanguage || 'unknown',
      targetLanguage,
    }
  }
}

/**
 * Dual translate - returns both machine translation and LLM translation
 * Machine translation is fast (free APIs), LLM is slower but higher quality
 * LLM uses user-configured API keys
 */
export async function dualTranslate(request: TranslateRequest): Promise<DualTranslateResponse> {
  const { text, targetLanguage, sourceLanguage, context, model, modelId } = request

  // Get user's API keys
  const { apiKeys, provider, model: selectedModel } = await getUserConfig()

  try {
    const result = await apiRequest<{
      machine: {
        translatedText: string | null
        provider: string | null
        error?: string
      }
      llm: {
        translatedText: string | null
        model: string | null
        error?: string
        available: boolean
      }
      sourceLang: string
      targetLang: string
    }>('/api/translate/dual', 'POST', {
      text,
      targetLang: targetLanguage,
      sourceLang: sourceLanguage,
      context,
      model: model || provider,
      modelId: modelId || selectedModel,
      apiKeys,
    })

    return {
      machine: result.machine,
      llm: result.llm,
      sourceLanguage: result.sourceLang,
      targetLanguage: result.targetLang,
    }
  } catch (error) {
    console.error('Dual translation API error:', error)
    // Return fallback with error
    return {
      machine: {
        translatedText: null,
        provider: null,
        error: error instanceof Error ? error.message : 'Translation failed',
      },
      llm: {
        translatedText: null,
        model: null,
        available: false,
      },
      sourceLanguage: sourceLanguage || 'unknown',
      targetLanguage,
    }
  }
}

/**
 * Batch translate multiple texts
 */
export async function batchTranslate(
  request: BatchTranslateRequest
): Promise<BatchTranslateResponse> {
  const { texts, targetLanguage, sourceLanguage, context, model } = request

  // Get user's API keys
  const { apiKeys, provider } = await getUserConfig()

  try {
    const result = await apiRequest<{
      translations: string[]
      sourceLang: string
      targetLang: string
      model: string
      cachedCount: number
    }>('/api/translate/batch', 'POST', {
      texts,
      targetLang: targetLanguage,
      sourceLang: sourceLanguage,
      context,
      model: model || provider,
      apiKeys,
    })

    return {
      translations: result.translations,
      sourceLanguage: result.sourceLang,
      targetLanguage: result.targetLang,
      model: result.model,
      cachedCount: result.cachedCount,
    }
  } catch (error) {
    console.error('Batch translation API error:', error)
    // Return original texts as fallback
    return {
      translations: texts.map((t) => `[Translation pending] ${t}`),
      sourceLanguage: sourceLanguage || 'unknown',
      targetLanguage,
    }
  }
}

/**
 * Free translation (no API key required)
 */
export async function freeTranslate(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslateResponse> {
  try {
    const result = await apiRequest<{
      translatedText: string
      sourceLang: string
      targetLang: string
      provider: string
    }>('/api/translate/free', 'POST', {
      text,
      targetLang: targetLanguage,
      sourceLang: sourceLanguage,
    })

    return {
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLang,
      targetLanguage: result.targetLang,
      model: result.provider,
    }
  } catch (error) {
    console.error('Free translation API error:', error)
    return {
      translatedText: `[Translation pending] ${text}`,
      sourceLanguage: sourceLanguage || 'unknown',
      targetLanguage,
    }
  }
}

/**
 * Request web page translation (batch translation for page texts)
 */
export async function requestWebPageTranslation(
  texts: string[],
  sourceLanguage: string,
  targetLanguage: string
): Promise<BatchTranslateResponse> {
  return batchTranslate({
    texts,
    sourceLanguage,
    targetLanguage,
  })
}

/**
 * Analyze page context
 */
export async function analyzeContext(content: string, url?: string): Promise<PageContext> {
  try {
    const result = await apiRequest<{
      context: PageContext
      confidence: number
    }>('/api/context', 'POST', { content, url })

    return result.context
  } catch (_error) {
    // Return default context
    return {
      type: 'general',
      tone: 'neutral',
    }
  }
}

/**
 * Quick context detection (local, fast)
 */
export async function quickContextDetection(content: string): Promise<PageContext> {
  // Simple heuristic-based context detection
  const technicalTerms = ['function', 'const', 'let', 'var', 'class', 'API', 'npm', 'git']
  const newsTerms = ['breaking', 'report', 'today', 'announced', 'officials']
  const academicTerms = ['study', 'research', 'analysis', 'methodology', 'hypothesis']

  const words = content.toLowerCase().split(/\s+/)
  const technicalCount = words.filter((w) => technicalTerms.includes(w)).length
  const newsCount = words.filter((w) => newsTerms.includes(w)).length
  const academicCount = words.filter((w) => academicTerms.includes(w)).length

  let type: PageContext['type'] = 'general'
  if (technicalCount > 5) type = 'technical'
  else if (newsCount > 3) type = 'news'
  else if (academicCount > 3) type = 'academic'

  return {
    type,
    tone: 'neutral',
  }
}

/**
 * Summarize content
 */
export async function summarizeContent(
  text: string,
  targetLanguage?: string
): Promise<SummaryResponse> {
  const { apiKeys, provider, model } = await getUserConfig()

  try {
    const result = await apiRequest<SummaryResponse>('/api/summary', 'POST', {
      text,
      targetLang: targetLanguage,
      apiKeys,
      model: provider,
      modelId: model,
    })
    return result
  } catch (_error) {
    return {
      summary: text.slice(0, 200) + '...',
      keyPoints: [],
      estimatedReadTime: Math.ceil(text.split(/\s+/).length / 200),
    }
  }
}

/**
 * Get translation memory stats
 */
export async function getMemoryStats(): Promise<{
  totalEntries: number
  languages: string[]
  recentTranslations: number
}> {
  try {
    return await apiRequest('/api/memory/stats', 'GET')
  } catch (_error) {
    return {
      totalEntries: 0,
      languages: [],
      recentTranslations: 0,
    }
  }
}

/**
 * Rate a translation for quality feedback
 */
export async function rateTranslation(
  sourceText: string,
  translatedText: string,
  rating: number
): Promise<void> {
  try {
    await apiRequest('/api/memory/rate', 'POST', {
      sourceText,
      translatedText,
      rating,
    })
  } catch (error) {
    console.error('Failed to rate translation:', error)
  }
}
