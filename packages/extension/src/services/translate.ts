/**
 * Translation Service
 * Connects to the AI Translation Agent backend
 */

// Backend API configuration - uses Vite's define or falls back to env check
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8787' : 'https://webtrans-api.your-domain.workers.dev')

export type ModelProvider = 'openai' | 'claude' | 'deepseek'

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
 * Translate a single text
 */
export async function translate(request: TranslateRequest): Promise<TranslateResponse> {
  const {
    text,
    targetLanguage,
    sourceLanguage,
    context,
    model,
    useCache = true,
    useMemory = true,
  } = request

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
      model,
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
 * Batch translate multiple texts
 * Used for web page translation
 */
export async function batchTranslate(
  request: BatchTranslateRequest
): Promise<BatchTranslateResponse> {
  const { texts, targetLanguage, sourceLanguage, context, model } = request

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
      model,
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
    // Return fallback
    return {
      translations: texts.map((t) => `[Translation pending] ${t}`),
      sourceLanguage: sourceLanguage || 'unknown',
      targetLanguage,
    }
  }
}

/**
 * Translation API for web page translation
 * Matches the format expected by the webpage-translation module
 */
export async function requestWebPageTranslation(
  textList: string[],
  sourceLanguage: string = 'detect',
  targetLanguage: string = 'zh'
): Promise<{ translations: string[] }> {
  const result = await batchTranslate({
    texts: textList,
    sourceLanguage: sourceLanguage === 'detect' ? undefined : sourceLanguage,
    targetLanguage,
  })

  return { translations: result.translations }
}

/**
 * Analyze page context for better translations
 */
export async function analyzeContext(
  content: string,
  url?: string,
  title?: string
): Promise<PageContext> {
  try {
    const result = await apiRequest<{ context: PageContext }>('/api/context', 'POST', {
      content,
      url,
      title,
    })
    return result.context
  } catch (error) {
    console.error('Context analysis error:', error)
    // Quick fallback using URL heuristics
    return quickContextDetection(url, title)
  }
}

/**
 * Quick context detection (local, no API call)
 */
export function quickContextDetection(url?: string, title?: string): PageContext {
  const urlLower = url?.toLowerCase() || ''
  const titleLower = title?.toLowerCase() || ''
  const combined = urlLower + ' ' + titleLower

  if (
    combined.includes('github') ||
    combined.includes('stackoverflow') ||
    combined.includes('docs.')
  ) {
    return { type: 'technical', tone: 'formal' }
  }
  if (combined.includes('news') || combined.includes('bbc') || combined.includes('cnn')) {
    return { type: 'news', tone: 'formal' }
  }
  if (combined.includes('arxiv') || combined.includes('scholar') || combined.includes('.edu')) {
    return { type: 'academic', tone: 'formal' }
  }
  if (combined.includes('twitter') || combined.includes('reddit') || combined.includes('blog')) {
    return { type: 'casual', tone: 'informal' }
  }

  return { type: 'general', tone: 'neutral' }
}

/**
 * Summarize content
 */
export async function summarizeContent(
  text: string,
  targetLang?: string
): Promise<SummaryResponse> {
  try {
    const result = await apiRequest<SummaryResponse>('/api/summary', 'POST', {
      text,
      targetLang,
      includeKeyPoints: true,
    })
    return result
  } catch (error) {
    console.error('Summary API error:', error)
    // Return basic fallback
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    return {
      summary: sentences.slice(0, 3).join('. ').trim() || 'Summary unavailable',
      keyPoints: [],
      estimatedReadTime: Math.ceil(text.split(/\s+/).length / 200),
    }
  }
}

/**
 * Get translation memory statistics
 */
export async function getMemoryStats(): Promise<{
  totalEntries: number
  totalUses: number
  languagePairs: number
}> {
  try {
    const result = await apiRequest<{
      totalEntries: number
      totalUses: number
      languagePairs: number
    }>('/api/memory/stats', 'GET')
    return result
  } catch (error) {
    console.error('Memory stats error:', error)
    return { totalEntries: 0, totalUses: 0, languagePairs: 0 }
  }
}

/**
 * Rate a translation quality (saves to memory)
 */
export async function rateTranslation(memoryId: number, score: number): Promise<boolean> {
  try {
    await apiRequest(`/api/memory/${memoryId}/quality`, 'PUT', { score })
    return true
  } catch (error) {
    console.error('Rate translation error:', error)
    return false
  }
}
