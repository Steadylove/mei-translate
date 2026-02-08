/**
 * Translation Service
 * Connects to the AI Translation Agent backend
 * Includes user-configured API keys for LLM translation
 */

import Storage, { ModelProvider, UserApiKeys } from './storage'

// Backend API configuration - uses Vite's define or falls back to env check
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:8787' : 'https://webtrans-api.meitrans.workers.dev')

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
 * Refine translation request/response
 */
export interface RefineTranslateRequest {
  originalText: string
  currentTranslation: string
  instruction: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  targetLang: string
  sourceLang?: string
  model?: ModelProvider
  modelId?: string
}

export interface RefineTranslateResponse {
  refinedText: string
  model: string
}

/**
 * Refine a translation through multi-turn conversation with LLM
 */
export async function refineTranslation(
  request: RefineTranslateRequest
): Promise<RefineTranslateResponse> {
  const { apiKeys, provider, model: selectedModel } = await getUserConfig()

  const result = await apiRequest<RefineTranslateResponse>('/api/translate/refine', 'POST', {
    originalText: request.originalText,
    currentTranslation: request.currentTranslation,
    instruction: request.instruction,
    history: request.history,
    targetLang: request.targetLang,
    sourceLang: request.sourceLang,
    apiKeys,
    model: request.model || provider,
    modelId: request.modelId || selectedModel,
  })

  return result
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
