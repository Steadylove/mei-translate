/**
 * Context Analysis API Routes
 */

import { Hono } from 'hono'
import type { Env, ContextAnalysisRequest, ApiResponse, ContextAnalysisResponse } from '../types'
import { analyzeContext, quickContextDetection } from '../agents/context'

export const contextRoute = new Hono<{ Bindings: Env }>()

/**
 * POST /api/context
 * Analyze page content to determine translation context
 */
contextRoute.post('/', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<ContextAnalysisRequest>()
    const { content, url, title } = body

    if (!content) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required field: content',
        },
        400
      )
    }

    const result = await analyzeContext(c.env, content, url, title)

    return c.json<ApiResponse<ContextAnalysisResponse>>({
      success: true,
      data: result,
      meta: {
        processingTime: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error('Context analysis error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Context analysis failed',
      },
      500
    )
  }
})

/**
 * POST /api/context/quick
 * Quick context detection using URL/title heuristics (no LLM call)
 */
contextRoute.post('/quick', async (c) => {
  try {
    const body = await c.req.json<{ url?: string; title?: string }>()
    const { url, title } = body

    if (!url && !title) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'At least one of url or title is required',
        },
        400
      )
    }

    const context = quickContextDetection(url, title)

    return c.json<ApiResponse<typeof context>>({
      success: true,
      data: {
        type: context.type || 'general',
        tone: context.tone || 'neutral',
        url,
        title,
      },
    })
  } catch (_error) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Quick context detection failed',
      },
      500
    )
  }
})
