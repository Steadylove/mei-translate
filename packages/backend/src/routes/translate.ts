/**
 * Translation API Routes
 */

import { Hono } from 'hono'
import type { Env, TranslateRequest, BatchTranslateRequest, ApiResponse } from '../types'
import { translateText, translateBatch, detectLanguage, saveToMemory } from '../agents/translator'
import { estimateCost } from '../providers'

export const translateRoute = new Hono<{ Bindings: Env }>()

/**
 * POST /api/translate
 * Translate a single text
 */
translateRoute.post('/', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<TranslateRequest>()
    const { text, targetLang, sourceLang, context, model, useCache = true, useMemory = true } = body

    if (!text || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: text and targetLang',
        },
        400
      )
    }

    const result = await translateText(c.env, text, targetLang, {
      sourceLang,
      context,
      model,
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
    const _cost = result.tokensUsed ? estimateCost(result.tokensUsed, result.model) : 0

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
 * Translate multiple texts at once
 */
translateRoute.post('/batch', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<BatchTranslateRequest>()
    const { texts, targetLang, sourceLang, context, model } = body

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required field: texts (array)',
        },
        400
      )
    }

    if (!targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required field: targetLang',
        },
        400
      )
    }

    // Limit batch size
    if (texts.length > 100) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Batch size exceeds limit (max 100)',
        },
        400
      )
    }

    const result = await translateBatch(c.env, texts, targetLang, {
      sourceLang,
      context,
      model,
      useCache: true,
    })

    const processingTime = Date.now() - startTime
    const detectedSourceLang = sourceLang || detectLanguage(texts[0] || '')

    return c.json<
      ApiResponse<{
        translations: string[]
        sourceLang: string
        targetLang: string
        model: string
        cachedCount: number
      }>
    >({
      success: true,
      data: {
        translations: result.translations,
        sourceLang: detectedSourceLang,
        targetLang,
        model: result.model,
        cachedCount: result.cachedCount,
      },
      meta: {
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
  } catch (_error) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Language detection failed',
      },
      500
    )
  }
})
