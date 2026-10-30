/**
 * Translation API Routes
 * Uses the server-managed DeepSeek model for all LLM operations.
 */

import { Hono } from 'hono'
import type {
  Env,
  TranslateRequest,
  BatchTranslateRequest,
  RefineRequest,
  ApiResponse,
} from '../types'
import {
  translateWithServerKey,
  translateBatch,
  detectLanguage,
  saveToMemory,
  refineTranslation,
} from '../agents/translator'
import { freeTranslate, detectLanguage as freeDetectLanguage } from '../providers/free-translate'
import {
  getFirstAvailableProvider,
  getServerApiKeys,
  PROVIDER_CONFIG,
  SERVER_MODEL,
  SERVER_MODEL_ID,
} from '../providers'

export const translateRoute = new Hono<{ Bindings: Env }>()

/**
 * GET /api/translate/providers
 * Get the server-managed LLM provider and model
 */
translateRoute.get('/providers', async (c) => {
  return c.json<ApiResponse<typeof PROVIDER_CONFIG>>({
    success: true,
    data: { [SERVER_MODEL]: PROVIDER_CONFIG[SERVER_MODEL] } as typeof PROVIDER_CONFIG,
  })
})

/**
 * POST /api/translate
 * Translate a single text using the server-managed DeepSeek model
 */
translateRoute.post('/', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<TranslateRequest>()
    const { text, targetLang, sourceLang, context, useCache = true, useMemory = true } = body

    const serverApiKeys = getServerApiKeys(c.env)

    if (!text || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: text and targetLang',
        },
        400
      )
    }

    if (!getFirstAvailableProvider(serverApiKeys)) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Server DeepSeek API key is not configured.',
        },
        503
      )
    }

    const result = await translateWithServerKey(c.env, text, targetLang, serverApiKeys, {
      sourceLang,
      context,
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
    const { texts, targetLang, sourceLang, context } = body
    const serverApiKeys = getServerApiKeys(c.env)

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

    if (!getFirstAvailableProvider(serverApiKeys)) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Server DeepSeek API key is not configured.',
        },
        503
      )
    }

    const result = await translateBatch(c.env, texts, targetLang, serverApiKeys, {
      sourceLang,
      context,
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
    const { text, targetLang, sourceLang, context } = body
    const serverApiKeys = getServerApiKeys(c.env)

    if (!text || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: text and targetLang',
        },
        400
      )
    }

    const hasLLMConfig = getFirstAvailableProvider(serverApiKeys)

    console.log('[Dual] LLM configured:', !!hasLLMConfig, 'model:', SERVER_MODEL_ID)

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
      ? translateWithServerKey(c.env, text, targetLang, serverApiKeys, {
          sourceLang,
          context,
          useCache: true,
          useMemory: true,
        }).catch((err) => {
          console.error('[Dual] LLM translation error:', err)
          return {
            error: err.message,
            translatedText: null,
            model: null,
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
 * POST /api/translate/refine
 * Refine a translation through multi-turn conversation with LLM
 */
translateRoute.post('/refine', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<RefineRequest>()
    const { originalText, currentTranslation, instruction, history, targetLang, sourceLang } = body

    const serverApiKeys = getServerApiKeys(c.env)

    if (!originalText || !currentTranslation || !instruction || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error:
            'Missing required fields: originalText, currentTranslation, instruction, targetLang',
        },
        400
      )
    }

    if (!getFirstAvailableProvider(serverApiKeys)) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Server DeepSeek API key is not configured.',
        },
        503
      )
    }

    const result = await refineTranslation(c.env, {
      originalText,
      currentTranslation,
      instruction,
      history: history || [],
      targetLang,
      sourceLang,
      apiKeys: serverApiKeys,
    })

    const processingTime = Date.now() - startTime

    return c.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
      meta: {
        processingTime,
      },
    })
  } catch (error) {
    console.error('Refine translation error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Translation refinement failed',
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
