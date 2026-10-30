/**
 * Reading Agent API Routes
 */

import { Hono } from 'hono'
import type {
  ApiResponse,
  Env,
  ReadingAskRequest,
  ReadingAskResponse,
  ReadingExplainRequest,
  ReadingExplainResponse,
  ReadingSearchRequest,
  ReadingSearchResponse,
} from '../types'
import { askAboutSelection, explainSelection, searchSelection } from '../agents/reading'
import { getServerApiKeys } from '../providers'

export const readingRoute = new Hono<{ Bindings: Env }>()

/**
 * POST /api/reading/explain
 * Explain selected text using server-managed DeepSeek and page context.
 */
readingRoute.post('/explain', async (c) => {
  try {
    const body = await c.req.json<ReadingExplainRequest>()
    const { text, targetLang, context } = body

    if (!text || !targetLang) {
      return c.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: text and targetLang' },
        400
      )
    }

    const result = await explainSelection(c.env, text, targetLang, context, getServerApiKeys(c.env))

    return c.json<ApiResponse<ReadingExplainResponse>>({
      success: true,
      data: result,
      meta: { model: 'deepseek-chat' },
    })
  } catch (error) {
    console.error('Reading explanation error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reading explanation failed',
      },
      500
    )
  }
})

/**
 * POST /api/reading/ask
 * Answer a follow-up question about selected text and page context.
 */
readingRoute.post('/ask', async (c) => {
  try {
    const body = await c.req.json<ReadingAskRequest>()
    const { text, question, targetLang, context, history = [] } = body

    if (!text || !question || !targetLang) {
      return c.json<ApiResponse<null>>(
        { success: false, error: 'Missing required fields: text, question and targetLang' },
        400
      )
    }

    const result = await askAboutSelection(
      c.env,
      text,
      question,
      targetLang,
      context,
      history,
      getServerApiKeys(c.env)
    )

    return c.json<ApiResponse<ReadingAskResponse>>({
      success: true,
      data: result,
      meta: { model: 'deepseek-chat' },
    })
  } catch (error) {
    console.error('Reading follow-up error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reading follow-up failed',
      },
      500
    )
  }
})

/**
 * POST /api/reading/search
 * Search the web for selected text after an explicit reader action.
 */
readingRoute.post('/search', async (c) => {
  try {
    const body = await c.req.json<ReadingSearchRequest>()
    const { text, context } = body

    if (!text?.trim()) {
      return c.json<ApiResponse<null>>(
        { success: false, error: 'Missing required field: text' },
        400
      )
    }

    if (!c.env.TAVILY_API_KEY) {
      return c.json<ApiResponse<null>>(
        { success: false, error: 'Tavily API key is not configured.' },
        503
      )
    }

    const result = await searchSelection(text, context, c.env.TAVILY_API_KEY)

    return c.json<ApiResponse<ReadingSearchResponse>>({
      success: true,
      data: result,
      meta: { free: false },
    })
  } catch (error) {
    console.error('Reading web search error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Web search failed',
      },
      502
    )
  }
})
