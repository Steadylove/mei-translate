/**
 * Translation Memory API Routes
 */

import { Hono } from 'hono'
import type { Env, ApiResponse, TranslationMemoryEntry } from '../types'
import { hashText } from '../utils/hash'

export const memoryRoute = new Hono<{ Bindings: Env }>()

/**
 * GET /api/memory
 * Get translation memory entries with optional filters
 */
memoryRoute.get('/', async (c) => {
  try {
    const { sourceLang, targetLang, limit = '50', offset = '0' } = c.req.query()

    let query = 'SELECT * FROM translation_memory'
    const params: (string | number)[] = []
    const conditions: string[] = []

    if (sourceLang) {
      conditions.push('source_lang = ?')
      params.push(sourceLang)
    }
    if (targetLang) {
      conditions.push('target_lang = ?')
      params.push(targetLang)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY use_count DESC, updated_at DESC'
    query += ' LIMIT ? OFFSET ?'
    params.push(parseInt(limit), parseInt(offset))

    const results = await c.env.DB.prepare(query)
      .bind(...params)
      .all<TranslationMemoryEntry>()

    return c.json<ApiResponse<{ entries: TranslationMemoryEntry[]; count: number }>>({
      success: true,
      data: {
        entries: results.results || [],
        count: results.results?.length || 0,
      },
    })
  } catch (error) {
    console.error('Memory fetch error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch translation memory',
      },
      500
    )
  }
})

/**
 * GET /api/memory/search
 * Search translation memory
 */
memoryRoute.get('/search', async (c) => {
  try {
    const { text, sourceLang, targetLang } = c.req.query()

    if (!text) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required query parameter: text',
        },
        400
      )
    }

    const sourceHash = await hashText(text)

    let query = `
      SELECT * FROM translation_memory
      WHERE source_hash = ?
    `
    const params: string[] = [sourceHash]

    if (sourceLang) {
      query += ' AND source_lang = ?'
      params.push(sourceLang)
    }
    if (targetLang) {
      query += ' AND target_lang = ?'
      params.push(targetLang)
    }

    query += ' LIMIT 1'

    const result = await c.env.DB.prepare(query)
      .bind(...params)
      .first<TranslationMemoryEntry>()

    if (result) {
      // Increment use count
      await c.env.DB.prepare(
        `
        UPDATE translation_memory
        SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
        .bind(result.id)
        .run()

      return c.json<ApiResponse<{ entry: TranslationMemoryEntry; found: true }>>({
        success: true,
        data: { entry: result, found: true },
      })
    }

    return c.json<ApiResponse<{ found: false }>>({
      success: true,
      data: { found: false },
    })
  } catch (error) {
    console.error('Memory search error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to search translation memory',
      },
      500
    )
  }
})

/**
 * POST /api/memory
 * Add entry to translation memory
 */
memoryRoute.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      sourceText: string
      targetText: string
      sourceLang: string
      targetLang: string
      contextType?: string
      modelUsed?: string
    }>()

    const { sourceText, targetText, sourceLang, targetLang, contextType, modelUsed } = body

    if (!sourceText || !targetText || !sourceLang || !targetLang) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields',
        },
        400
      )
    }

    const sourceHash = await hashText(sourceText)

    await c.env.DB.prepare(
      `
      INSERT INTO translation_memory
        (source_hash, source_text, target_text, source_lang, target_lang, context_type, model_used)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_hash, source_lang, target_lang)
      DO UPDATE SET
        target_text = excluded.target_text,
        use_count = use_count + 1,
        updated_at = CURRENT_TIMESTAMP
    `
    )
      .bind(
        sourceHash,
        sourceText,
        targetText,
        sourceLang,
        targetLang,
        contextType || 'general',
        modelUsed || 'unknown'
      )
      .run()

    return c.json<ApiResponse<{ saved: true }>>({
      success: true,
      data: { saved: true },
    })
  } catch (error) {
    console.error('Memory save error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to save to translation memory',
      },
      500
    )
  }
})

/**
 * PUT /api/memory/:id/quality
 * Update quality score for a memory entry
 */
memoryRoute.put('/:id/quality', async (c) => {
  try {
    const id = c.req.param('id')
    const { score } = await c.req.json<{ score: number }>()

    if (typeof score !== 'number' || score < 0 || score > 10) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Score must be a number between 0 and 10',
        },
        400
      )
    }

    await c.env.DB.prepare(
      `
      UPDATE translation_memory
      SET quality_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    )
      .bind(score, parseInt(id))
      .run()

    return c.json<ApiResponse<{ updated: true }>>({
      success: true,
      data: { updated: true },
    })
  } catch (error) {
    console.error('Quality update error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to update quality score',
      },
      500
    )
  }
})

/**
 * DELETE /api/memory/:id
 * Delete a memory entry
 */
memoryRoute.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')

    await c.env.DB.prepare('DELETE FROM translation_memory WHERE id = ?').bind(parseInt(id)).run()

    return c.json<ApiResponse<{ deleted: true }>>({
      success: true,
      data: { deleted: true },
    })
  } catch (error) {
    console.error('Memory delete error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to delete memory entry',
      },
      500
    )
  }
})

/**
 * GET /api/memory/stats
 * Get translation memory statistics
 */
memoryRoute.get('/stats', async (c) => {
  try {
    const stats = await c.env.DB.prepare(
      `
      SELECT
        COUNT(*) as total_entries,
        SUM(use_count) as total_uses,
        COUNT(DISTINCT source_lang || '-' || target_lang) as language_pairs,
        AVG(quality_score) as avg_quality
      FROM translation_memory
    `
    ).first<{
      total_entries: number
      total_uses: number
      language_pairs: number
      avg_quality: number
    }>()

    const topPairs = await c.env.DB.prepare(
      `
      SELECT
        source_lang,
        target_lang,
        COUNT(*) as count
      FROM translation_memory
      GROUP BY source_lang, target_lang
      ORDER BY count DESC
      LIMIT 5
    `
    ).all<{ source_lang: string; target_lang: string; count: number }>()

    return c.json<
      ApiResponse<{
        totalEntries: number
        totalUses: number
        languagePairs: number
        avgQuality: number
        topPairs: Array<{ sourceLang: string; targetLang: string; count: number }>
      }>
    >({
      success: true,
      data: {
        totalEntries: stats?.total_entries || 0,
        totalUses: stats?.total_uses || 0,
        languagePairs: stats?.language_pairs || 0,
        avgQuality: stats?.avg_quality || 0,
        topPairs: (topPairs.results || []).map((p) => ({
          sourceLang: p.source_lang,
          targetLang: p.target_lang,
          count: p.count,
        })),
      },
    })
  } catch (error) {
    console.error('Stats fetch error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch memory statistics',
      },
      500
    )
  }
})

/**
 * POST /api/memory/export
 * Export translation memory as JSON
 */
memoryRoute.post('/export', async (c) => {
  try {
    const { sourceLang, targetLang } = await c.req.json<{
      sourceLang?: string
      targetLang?: string
    }>()

    let query =
      'SELECT source_text, target_text, source_lang, target_lang, context_type FROM translation_memory'
    const params: string[] = []
    const conditions: string[] = []

    if (sourceLang) {
      conditions.push('source_lang = ?')
      params.push(sourceLang)
    }
    if (targetLang) {
      conditions.push('target_lang = ?')
      params.push(targetLang)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY use_count DESC LIMIT 1000'

    const results = await c.env.DB.prepare(query)
      .bind(...params)
      .all<{
        source_text: string
        target_text: string
        source_lang: string
        target_lang: string
        context_type: string
      }>()

    return c.json<ApiResponse<{ entries: typeof results.results; count: number }>>({
      success: true,
      data: {
        entries: results.results || [],
        count: results.results?.length || 0,
      },
    })
  } catch (error) {
    console.error('Export error:', error)
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to export translation memory',
      },
      500
    )
  }
})
