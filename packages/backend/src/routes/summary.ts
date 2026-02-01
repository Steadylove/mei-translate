/**
 * Summary API Routes
 */

import { Hono } from 'hono'
import type { Env, SummaryRequest, ApiResponse, SummaryResponse } from '../types'
import { summarizeText, summarizeDocument, progressiveSummarize } from '../agents/summarizer'

export const summaryRoute = new Hono<{ Bindings: Env }>()

/**
 * POST /api/summary
 * Summarize text content
 */
summaryRoute.post('/', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<SummaryRequest>()
    const { text, targetLang, maxLength, includeKeyPoints = true } = body

    if (!text) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required field: text',
        },
        400
      )
    }

    const result = await summarizeText(c.env, text, {
      targetLang,
      maxLength,
      includeKeyPoints,
    })

    return c.json<ApiResponse<SummaryResponse>>({
      success: true,
      data: result,
      meta: {
        processingTime: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error('Summary error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Summarization failed',
      },
      500
    )
  }
})

/**
 * POST /api/summary/document
 * Summarize a document with title
 */
summaryRoute.post('/document', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<{
      title: string
      content: string
      targetLang?: string
    }>()
    const { title, content, targetLang } = body

    if (!title || !content) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: title and content',
        },
        400
      )
    }

    const result = await summarizeDocument(c.env, title, content, targetLang)

    return c.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
      meta: {
        processingTime: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error('Document summary error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Document summarization failed',
      },
      500
    )
  }
})

/**
 * POST /api/summary/progressive
 * Progressive summarization for very long content
 */
summaryRoute.post('/progressive', async (c) => {
  const startTime = Date.now()

  try {
    const body = await c.req.json<{
      content: string
      targetLang?: string
    }>()
    const { content, targetLang } = body

    if (!content) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required field: content',
        },
        400
      )
    }

    // Check content length
    if (content.length < 5000) {
      // Use regular summarization for short content
      const result = await summarizeText(c.env, content, {
        targetLang,
        includeKeyPoints: true,
      })
      return c.json<ApiResponse<SummaryResponse>>({
        success: true,
        data: result,
        meta: {
          processingTime: Date.now() - startTime,
        },
      })
    }

    const result = await progressiveSummarize(c.env, content, targetLang)

    return c.json<ApiResponse<SummaryResponse>>({
      success: true,
      data: result,
      meta: {
        processingTime: Date.now() - startTime,
      },
    })
  } catch (error) {
    console.error('Progressive summary error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Progressive summarization failed',
      },
      500
    )
  }
})
