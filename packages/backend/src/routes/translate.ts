/**
 * Translation API Routes
 * Supports user-provided API keys from request body
 */

import { Hono } from 'hono'
import type {
  Env,
  TranslateRequest,
  BatchTranslateRequest,
  ApiResponse,
  UserApiKeys,
  ModelProvider,
} from '../types'
import {
  translateWithUserKeys,
  translateBatch,
  detectLanguage,
  saveToMemory,
} from '../agents/translator'
import { freeTranslate, detectLanguage as freeDetectLanguage } from '../providers/free-translate'
import { getFirstAvailableProvider, PROVIDER_CONFIG } from '../providers'

export const translateRoute = new Hono<{ Bindings: Env }>()

/**
 * GET /api/translate/providers
 * Get all available LLM providers and their models
 */
translateRoute.get('/providers', async (c) => {
  return c.json<ApiResponse<typeof PROVIDER_CONFIG>>({
    success: true,
    data: PROVIDER_CONFIG,
  })
})

/**
 * POST /api/translate
 * Translate a single text using user-provided API key
 */
translateRoute.post('/', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<TranslateRequest>()
    const {
      text,
      targetLang,
      sourceLang,
      context,
      model,
      modelId,
      apiKeys,
      useCache = true,
      useMemory = true,
    } = body

    if (!text || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: text and targetLang',
        },
        400
      )
    }

    // Check if user has configured any API key
    if (!apiKeys || !getFirstAvailableProvider(apiKeys)) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'No API key configured. Please add an API key in settings.',
        },
        400
      )
    }

    const result = await translateWithUserKeys(c.env, text, targetLang, apiKeys, {
      sourceLang,
      context,
      model,
      modelId,
      useCache,
      useMemory,
    })

    // Save to translation memory if enabled
    if (useMemory && !result.cached) {
      await saveToMemory(
        c.env,
        text,
        result.translatedText,
        result.sourceLang,
        result.targetLang,
        result.model,
        context?.type
      )
    }

    const processingTime = Date.now() - startTime

    return c.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
      meta: {
        cached: result.cached,
        model: result.model,
        tokensUsed: result.tokensUsed,
        processingTime,
      },
    })
  } catch (error) {
    console.error('Translation error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed',
      },
      500
    )
  }
})

/**
 * POST /api/translate/batch
 * Batch translate multiple texts
 */
translateRoute.post('/batch', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<BatchTranslateRequest>()
    const { texts, targetLang, sourceLang, context, model, apiKeys } = body

    if (!texts || !Array.isArray(texts) || texts.length === 0 || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: texts (array) and targetLang',
        },
        400
      )
    }

    if (texts.length > 50) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Maximum 50 texts per batch',
        },
        400
      )
    }

    // Check if user has configured any API key
    if (!apiKeys || !getFirstAvailableProvider(apiKeys)) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'No API key configured. Please add an API key in settings.',
        },
        400
      )
    }

    const result = await translateBatch(c.env, texts, targetLang, apiKeys, {
      sourceLang,
      context,
      model,
    })

    const processingTime = Date.now() - startTime

    return c.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
      meta: {
        model: result.model,
        tokensUsed: result.tokensUsed,
        processingTime,
      },
    })
  } catch (error) {
    console.error('Batch translation error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Batch translation failed',
      },
      500
    )
  }
})

/**
 * POST /api/translate/detect
 * Detect language of text
 */
translateRoute.post('/detect', async (c) => {
  try {
    const { text } = await c.req.json<{ text: string }>()

    if (!text) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required field: text',
        },
        400
      )
    }

    const detectedLang = detectLanguage(text)

    return c.json<ApiResponse<{ language: string }>>({
      success: true,
      data: { language: detectedLang },
    })
  } catch (error) {
    console.error('Language detection error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Language detection failed',
      },
      500
    )
  }
})

/**
 * POST /api/translate/free
 * Free translation using machine translation (no API key required)
 */
translateRoute.post('/free', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<{ text: string; targetLang: string; sourceLang?: string }>()
    const { text, targetLang, sourceLang } = body

    if (!text || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: text and targetLang',
        },
        400
      )
    }

    const result = await freeTranslate(text, sourceLang || 'auto', targetLang)
    const processingTime = Date.now() - startTime

    return c.json<
      ApiResponse<{
        translatedText: string
        sourceLang: string
        targetLang: string
        provider: string
      }>
    >({
      success: true,
      data: {
        translatedText: result.translatedText,
        sourceLang: result.detectedSourceLang || sourceLang || 'auto',
        targetLang,
        provider: result.provider,
      },
      meta: {
        processingTime,
        free: true,
      },
    })
  } catch (error) {
    console.error('Free translation error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Free translation failed',
      },
      500
    )
  }
})

/**
 * POST /api/translate/dual
 * Dual translation: returns both machine translation (fast) and LLM translation (if configured)
 */
translateRoute.post('/dual', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<TranslateRequest>()
    const { text, targetLang, sourceLang, context, model, modelId, apiKeys } = body

    if (!text || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: text and targetLang',
        },
        400
      )
    }

    // Check if user has LLM configured
    const hasLLMConfig = apiKeys && getFirstAvailableProvider(apiKeys)

    console.log(
      '[Dual] LLM configured:',
      !!hasLLMConfig,
      'keys:',
      apiKeys ? Object.keys(apiKeys).filter((k) => apiKeys[k as keyof UserApiKeys]) : []
    )

    // Start both translations in parallel
    const machineTranslatePromise = freeTranslate(text, sourceLang || 'auto', targetLang).catch(
      (err) => ({
        error: err.message,
        translatedText: null,
        provider: null,
      })
    )

    // Only run LLM translation if configured
    const llmTranslatePromise = hasLLMConfig
      ? translateWithUserKeys(c.env, text, targetLang, apiKeys!, {
          sourceLang,
          context,
          model,
          modelId,
          useCache: true,
          useMemory: true,
        }).catch((err) => {
          console.error('[Dual] LLM translation error:', err)
          return {
            error: err.message,
            translatedText: null,
            model: null as ModelProvider | null,
          }
        })
      : Promise.resolve(null)

    // Wait for both results
    const [machineResult, llmResult] = await Promise.all([
      machineTranslatePromise,
      llmTranslatePromise,
    ])

    const processingTime = Date.now() - startTime

    // Build response
    const response = {
      machine: {
        translatedText: 'error' in machineResult ? null : machineResult.translatedText,
        provider: 'error' in machineResult ? null : machineResult.provider,
        error: 'error' in machineResult ? machineResult.error : undefined,
      },
      llm: {
        translatedText: llmResult && !('error' in llmResult) ? llmResult.translatedText : null,
        model: llmResult && !('error' in llmResult) ? llmResult.model : null,
        error: llmResult && 'error' in llmResult ? (llmResult.error as string) : undefined,
        available: !!hasLLMConfig,
      },
      sourceLang:
        ('detectedSourceLang' in machineResult && machineResult.detectedSourceLang) ||
        sourceLang ||
        'auto',
      targetLang,
    }

    return c.json<ApiResponse<typeof response>>({
      success: true,
      data: response,
      meta: {
        processingTime,
        llmConfigured: !!hasLLMConfig,
      },
    })
  } catch (error) {
    console.error('Dual translation error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed',
      },
      500
    )
  }
})

/**
 * POST /api/translate/free/detect
 * Free language detection
 */
translateRoute.post('/free/detect', async (c) => {
  try {
    const { text } = await c.req.json<{ text: string }>()

    if (!text) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required field: text',
        },
        400
      )
    }

    const language = await freeDetectLanguage(text)

    return c.json<ApiResponse<{ language: string }>>({
      success: true,
      data: { language },
    })
  } catch (error) {
    console.error('Language detection error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Language detection failed',
      },
      500
    )
  }
})
