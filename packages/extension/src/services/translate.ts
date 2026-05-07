/**
 * Translation Service
 * Connects to the Mei Lingua backend
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

type FreeTranslateProvider = 'google-direct' | 'mymemory'

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

const FREE_TRANSLATE_TIMEOUT_MS = 5000
const FREE_BATCH_CONCURRENCY = 6

function hasConfiguredApiKey(apiKeys: UserApiKeys): boolean {
  return Object.values(apiKeys).some((key) => key && key.trim().length > 0)
}

function normalizeFreeLanguageCode(lang?: string, provider?: FreeTranslateProvider): string {
  if (!lang || lang === 'detect') return provider === 'mymemory' ? 'autodetect' : 'auto'

  const normalized = lang.toLowerCase()
  if (normalized === 'zh' || normalized === 'zh-cn') {
    return provider === 'mymemory' ? 'zh-CN' : 'zh-CN'
  }

  return normalized.split('-')[0]
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FREE_TRANSLATE_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function translateWithGoogleDirectClient(
  text: string,
  sourceLanguage: string | undefined,
  targetLanguage: string
): Promise<{ translatedText: string; sourceLanguage: string; provider: FreeTranslateProvider }> {
  const source = normalizeFreeLanguageCode(sourceLanguage, 'google-direct')
  const target = normalizeFreeLanguageCode(targetLanguage, 'google-direct')
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`
  const response = await fetchWithTimeout(url)

  if (!response.ok) {
    throw new Error(`Google Direct error: ${response.status}`)
  }

  const data = await response.json()
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Invalid Google response format')
  }

  return {
    translatedText: data[0].map((item: unknown[]) => item[0]).join(''),
    sourceLanguage: (data[2] as string | undefined) || sourceLanguage || 'auto',
    provider: 'google-direct',
  }
}

async function translateWithMyMemoryClient(
  text: string,
  sourceLanguage: string | undefined,
  targetLanguage: string
): Promise<{ translatedText: string; sourceLanguage: string; provider: FreeTranslateProvider }> {
  const source = normalizeFreeLanguageCode(sourceLanguage, 'mymemory')
  const target = normalizeFreeLanguageCode(targetLanguage, 'mymemory')
  const langPair = `${source}|${target}`
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`
  const response = await fetchWithTimeout(url)

  if (!response.ok) {
    throw new Error(`MyMemory error: ${response.status}`)
  }

  const data = (await response.json()) as {
    responseStatus: number
    responseData?: {
      translatedText?: string
      detectedLanguage?: string
    }
    quotaFinished?: boolean
  }

  if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
    throw new Error(`MyMemory translation failed: ${data.responseStatus}`)
  }
  if (data.quotaFinished) {
    throw new Error('MyMemory daily quota exceeded')
  }

  return {
    translatedText: data.responseData.translatedText,
    sourceLanguage: data.responseData.detectedLanguage || sourceLanguage || 'auto',
    provider: 'mymemory',
  }
}

async function freeTranslateClient(
  text: string,
  sourceLanguage: string | undefined,
  targetLanguage: string
): Promise<{ translatedText: string; sourceLanguage: string; provider: FreeTranslateProvider }> {
  const providers = [
    translateWithGoogleDirectClient(text, sourceLanguage, targetLanguage),
    translateWithMyMemoryClient(text, sourceLanguage, targetLanguage),
  ]

  return new Promise((resolve, reject) => {
    const errors: string[] = []
    let failedCount = 0

    providers.forEach((providerPromise) => {
      providerPromise.then(resolve).catch((error: unknown) => {
        failedCount += 1
        errors.push(error instanceof Error ? error.message : String(error))

        if (failedCount === providers.length) {
          reject(new Error(`Free translation failed: ${errors.join('; ')}`))
        }
      })
    })
  })
}

async function freeBatchTranslateClient(
  texts: string[],
  sourceLanguage: string | undefined,
  targetLanguage: string
): Promise<{ translations: string[]; sourceLanguage: string; provider: FreeTranslateProvider }> {
  const translations: string[] = []
  let detectedSource = sourceLanguage || 'auto'
  let provider: FreeTranslateProvider = 'google-direct'

  for (let i = 0; i < texts.length; i += FREE_BATCH_CONCURRENCY) {
    const chunk = texts.slice(i, i + FREE_BATCH_CONCURRENCY)
    const results = await Promise.all(
      chunk.map((text) => freeTranslateClient(text, sourceLanguage, targetLanguage))
    )

    for (const result of results) {
      translations.push(result.translatedText)
      detectedSource = result.sourceLanguage
      provider = result.provider
    }
  }

  return { translations, sourceLanguage: detectedSource, provider }
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

  if (!hasConfiguredApiKey(apiKeys)) {
    const result = await freeTranslateClient(text, sourceLanguage, targetLanguage)
    return {
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage,
      targetLanguage,
      model: result.provider,
      cached: false,
    }
  }

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

  if (!hasConfiguredApiKey(apiKeys)) {
    const result = await freeTranslateClient(text, sourceLanguage, targetLanguage)
    return {
      machine: {
        translatedText: result.translatedText,
        provider: result.provider,
      },
      llm: {
        translatedText: null,
        model: null,
        available: false,
      },
      sourceLanguage: result.sourceLanguage,
      targetLanguage,
    }
  }

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

  if (!hasConfiguredApiKey(apiKeys)) {
    const result = await freeBatchTranslateClient(texts, sourceLanguage, targetLanguage)
    return {
      translations: result.translations,
      sourceLanguage: result.sourceLanguage,
      targetLanguage,
      model: result.provider,
      cachedCount: 0,
    }
  }

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
