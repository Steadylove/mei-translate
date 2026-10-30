/**
 * Translation Service
 * Connects to the Mei Lingua backend
 * AI requests use the server-managed DeepSeek model.
 */

// Backend API configuration - uses Vite's define or falls back to env check
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8787' : 'https://webtrans-api.meitrans.workers.dev')

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

export interface ReadingExplainResponse {
  explanation: string
  termExplanations: Array<{ term: string; explanation: string }>
}

export interface ReadingAskResponse {
  answer: string
}

export interface ReadingSearchResponse {
  answer?: string
  results: Array<{
    title: string
    url: string
    domain: string
    content: string
  }>
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

/** Analyze page context without exposing the generated summary to the user. */
export async function analyzePageContext(
  content: string,
  url?: string,
  title?: string
): Promise<PageContext> {
  const result = await apiRequest<{ context: PageContext }>('/api/context', 'POST', {
    content,
    url,
    title,
  })
  return result.context
}

/** Explain selected text with the server-managed Reading Agent. */
export async function explainSelection(
  text: string,
  targetLanguage: string,
  context?: PageContext
): Promise<ReadingExplainResponse> {
  return apiRequest<ReadingExplainResponse>('/api/reading/explain', 'POST', {
    text,
    targetLang: targetLanguage,
    context,
  })
}

/** Ask a follow-up question about selected text and page context. */
export async function askAboutSelection(
  text: string,
  question: string,
  targetLanguage: string,
  context?: PageContext,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<ReadingAskResponse> {
  return apiRequest<ReadingAskResponse>('/api/reading/ask', 'POST', {
    text,
    question,
    targetLang: targetLanguage,
    context,
    history,
  })
}

/** Search the web for selected text after an explicit reader action. */
export async function searchSelection(
  text: string,
  context?: PageContext
): Promise<ReadingSearchResponse> {
  return apiRequest<ReadingSearchResponse>('/api/reading/search', 'POST', {
    text,
    context,
  })
}

/** Translate a single text through the server-managed DeepSeek model. */
export async function translate(request: TranslateRequest): Promise<TranslateResponse> {
  const {
    text,
    targetLanguage,
    sourceLanguage,
    context,
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
    // Propagate the failure so the background script and UI can report it.
    // Returning a placeholder here makes a failed request look like a real translation.
    throw error
  }
}

/**
 * Dual translate - returns free machine translation and server-managed DeepSeek translation.
 */
export async function dualTranslate(request: TranslateRequest): Promise<DualTranslateResponse> {
  const { text, targetLanguage, sourceLanguage, context } = request

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
    })

    return {
      machine: result.machine,
      llm: result.llm,
      sourceLanguage: result.sourceLang,
      targetLanguage: result.targetLang,
    }
  } catch (error) {
    console.error('Dual translation API error:', error)
    // Network and backend failures should reach the UI as errors.
    throw error
  }
}

/** Batch translate through the server-managed DeepSeek model. */
export async function batchTranslate(
  request: BatchTranslateRequest
): Promise<BatchTranslateResponse> {
  const { texts, targetLanguage, sourceLanguage, context } = request

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
    // Do not insert placeholders into a page.
    throw error
  }
}

/** Refine a translation through the server-managed DeepSeek model. */
export interface RefineTranslateRequest {
  originalText: string
  currentTranslation: string
  instruction: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  targetLang: string
  sourceLang?: string
}

export interface RefineTranslateResponse {
  refinedText: string
  model: string
}

export async function refineTranslation(
  request: RefineTranslateRequest
): Promise<RefineTranslateResponse> {
  return apiRequest<RefineTranslateResponse>('/api/translate/refine', 'POST', {
    originalText: request.originalText,
    currentTranslation: request.currentTranslation,
    instruction: request.instruction,
    history: request.history,
    targetLang: request.targetLang,
    sourceLang: request.sourceLang,
  })
}

/** Request web page translation (batch translation for page texts). */
export async function requestWebPageTranslation(
  texts: string[],
  sourceLanguage: string | undefined,
  targetLanguage: string
): Promise<BatchTranslateResponse> {
  return batchTranslate({
    texts,
    sourceLanguage,
    targetLanguage,
  })
}
