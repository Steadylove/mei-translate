/**
 * Summarizer Agent
 * Generates intelligent summaries and optional translations
 */

import type { Env, SummaryResponse, SectionSummary, ChatMessage } from '../types'
import { getProvider } from '../providers'
import { translateText } from './translator'

export interface SummarizeOptions {
  targetLang?: string
  maxLength?: number
  includeKeyPoints?: boolean
  includeSections?: boolean
}

/**
 * Summarize text content
 */
export async function summarizeText(
  env: Env,
  text: string,
  options: SummarizeOptions = {}
): Promise<SummaryResponse> {
  const {
    targetLang,
    maxLength = 500,
    includeKeyPoints: _includeKeyPoints = true,
    includeSections = false,
  } = options

  // Estimate reading time (average 200 words per minute)
  const wordCount = text.split(/\s+/).length
  const estimatedReadTime = Math.ceil(wordCount / 200)

  const systemPrompt = `You are an expert content summarizer. Create a concise summary of the following text.

Return ONLY a valid JSON object with this structure:
{
  "summary": "3-5 sentence summary of the main content",
  "keyPoints": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"]${
    includeSections
      ? `,
  "sections": [
    {"title": "Section Title", "summary": "Brief section summary", "startIndex": 0, "endIndex": 100}
  ]`
      : ''
  }
}

Guidelines:
- The summary should capture the main ideas in ${maxLength} characters or less
- Include 3-5 key points that represent the most important information
- Key points should be actionable or informative takeaways
- Be concise but don't lose critical information`

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text.slice(0, 10000) }, // Limit input size
  ]

  try {
    // Use DeepSeek for summarization
    const provider = getProvider('deepseek', env)
    const response = await provider.chat(messages, {
      temperature: 0.3,
      maxTokens: 1000,
    })

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      summary: string
      keyPoints: string[]
      sections?: SectionSummary[]
    }

    const result: SummaryResponse = {
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || [],
      estimatedReadTime,
      sections: includeSections ? parsed.sections : undefined,
    }

    // Translate if target language specified
    if (targetLang) {
      // Translate summary
      const translatedSummary = await translateText(env, result.summary, targetLang, {
        useCache: true,
      })
      result.summaryTranslated = translatedSummary.translatedText

      // Translate key points
      if (result.keyPoints.length > 0) {
        const translatedPoints = await Promise.all(
          result.keyPoints.map((point) => translateText(env, point, targetLang, { useCache: true }))
        )
        result.keyPointsTranslated = translatedPoints.map((r) => r.translatedText)
      }
    }

    return result
  } catch (error) {
    console.error('Summarization failed:', error)

    // Return a basic summary on failure
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    const basicSummary = sentences.slice(0, 3).join('. ').trim()

    return {
      summary: basicSummary || 'Summary unavailable',
      keyPoints: [],
      estimatedReadTime,
    }
  }
}

/**
 * Summarize and optionally translate a long document
 * This is optimized for token efficiency
 */
export async function summarizeDocument(
  env: Env,
  title: string,
  content: string,
  targetLang?: string
): Promise<{
  title: string
  titleTranslated?: string
  summary: SummaryResponse
  wordCount: number
  estimatedSavings: string
}> {
  const wordCount = content.split(/\s+/).length

  // Get summary
  const summary = await summarizeText(env, content, {
    targetLang,
    includeKeyPoints: true,
    includeSections: true,
    maxLength: 500,
  })

  // Translate title if needed
  let titleTranslated: string | undefined
  if (targetLang) {
    const translatedTitle = await translateText(env, title, targetLang, {
      useCache: true,
    })
    titleTranslated = translatedTitle.translatedText
  }

  // Calculate estimated savings
  // Full translation would use ~wordCount tokens, summary uses ~500
  const fullTranslationTokens = wordCount * 1.3 // Rough estimate with overhead
  const summaryTokens = 1000 + (summary.summaryTranslated ? 500 : 0)
  const savings = Math.round((1 - summaryTokens / fullTranslationTokens) * 100)

  return {
    title,
    titleTranslated,
    summary,
    wordCount,
    estimatedSavings: `~${savings}% token savings vs full translation`,
  }
}

/**
 * Progressive summarization for very long content
 * Breaks content into chunks, summarizes each, then combines
 */
export async function progressiveSummarize(
  env: Env,
  content: string,
  targetLang?: string
): Promise<SummaryResponse> {
  const CHUNK_SIZE = 5000 // Characters per chunk
  const chunks: string[] = []

  // Split into chunks at paragraph boundaries
  let currentChunk = ''
  const paragraphs = content.split(/\n\n+/)

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > CHUNK_SIZE) {
      if (currentChunk) chunks.push(currentChunk)
      currentChunk = paragraph
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph
    }
  }
  if (currentChunk) chunks.push(currentChunk)

  // If only one chunk, use regular summarization
  if (chunks.length === 1) {
    return summarizeText(env, content, { targetLang, includeKeyPoints: true })
  }

  // Summarize each chunk
  const chunkSummaries = await Promise.all(
    chunks.map((chunk) =>
      summarizeText(env, chunk, {
        maxLength: 200,
        includeKeyPoints: true,
      })
    )
  )

  // Combine chunk summaries
  const combinedContent = chunkSummaries
    .map((s, i) => `Section ${i + 1}:\n${s.summary}\nKey points: ${s.keyPoints.join(', ')}`)
    .join('\n\n')

  // Create final summary from combined summaries
  const finalSummary = await summarizeText(env, combinedContent, {
    targetLang,
    maxLength: 500,
    includeKeyPoints: true,
  })

  // Merge all key points
  const allKeyPoints = chunkSummaries.flatMap((s) => s.keyPoints)
  const uniqueKeyPoints = [...new Set(allKeyPoints)].slice(0, 7)

  return {
    ...finalSummary,
    keyPoints: uniqueKeyPoints,
    estimatedReadTime: Math.ceil(content.split(/\s+/).length / 200),
  }
}
