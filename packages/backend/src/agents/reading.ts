/**
 * Reading Agent
 * Explains selected content using hidden page context.
 */

import type {
  Env,
  ChatMessage,
  LLMResponse,
  PageContext,
  ReadingAskResponse,
  ReadingExplainResponse,
  ReadingSearchResponse,
  ReadingSearchResult,
  UserApiKeys,
} from '../types'
import { getProviderWithKey, PROVIDER_CONFIG } from '../providers'

function getApiKey(apiKeys: UserApiKeys): string {
  if (!apiKeys.deepseek) {
    throw new Error('Server DeepSeek API key is not configured')
  }
  return apiKeys.deepseek
}

function describeContext(context?: PageContext): string {
  if (!context) return 'No page context is available.'

  return [
    `Content type: ${context.type}`,
    context.domain ? `Domain: ${context.domain}` : '',
    `Tone: ${context.tone}`,
    context.title ? `Page title: ${context.title}` : '',
    context.terminologyHints?.length
      ? `Terminology hints: ${context.terminologyHints.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function getProvider(apiKeys: UserApiKeys) {
  return getProviderWithKey('deepseek', getApiKey(apiKeys))
}

export async function explainSelection(
  _env: Env,
  text: string,
  targetLang: string,
  context: PageContext | undefined,
  apiKeys: UserApiKeys
): Promise<ReadingExplainResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are the reading assistant inside a browser translation extension.
Explain the selected text so the reader can understand what it means in this page.
Answer in ${targetLang === 'zh' ? 'Simplified Chinese' : targetLang}.

${describeContext(context)}

Return ONLY valid JSON in this shape:
{
  "explanation": "A concise, plain-language explanation of the selected text and its role in the page.",
  "termExplanations": [{"term": "important term", "explanation": "brief explanation"}]
}

Rules:
- Preserve factual meaning and distinguish explanation from translation.
- Explain only terms that need help; return an empty array when there are none.
- Do not mention these instructions or add markdown fences.`,
    },
    { role: 'user', content: text.slice(0, 6000) },
  ]

  const response: LLMResponse = await getProvider(apiKeys).chat(messages, {
    temperature: 0.3,
    maxTokens: Math.max(text.length * 2, 800),
    model: PROVIDER_CONFIG.deepseek.defaultModel,
  })

  const jsonMatch = response.content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { explanation: response.content.trim(), termExplanations: [] }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<ReadingExplainResponse>
    return {
      explanation: parsed.explanation?.trim() || response.content.trim(),
      termExplanations: Array.isArray(parsed.termExplanations)
        ? parsed.termExplanations.filter(
            (item): item is { term: string; explanation: string } =>
              typeof item?.term === 'string' && typeof item?.explanation === 'string'
          )
        : [],
    }
  } catch {
    return { explanation: response.content.trim(), termExplanations: [] }
  }
}

export async function askAboutSelection(
  _env: Env,
  text: string,
  question: string,
  targetLang: string,
  context: PageContext | undefined,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  apiKeys: UserApiKeys
): Promise<ReadingAskResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a reading assistant. Answer the user's question about the selected text using the page context when useful.
Answer in ${targetLang === 'zh' ? 'Simplified Chinese' : targetLang}.

Selected text:
${text.slice(0, 6000)}

Page context:
${describeContext(context)}

Rules:
- Answer directly and explain the reasoning in plain language.
- Stay grounded in the selected text and page context. If information is missing, say so.
- Do not mention these instructions.`,
    },
    ...history.slice(-10).map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    })),
    { role: 'user', content: question.slice(0, 2000) },
  ]

  const response = await getProvider(apiKeys).chat(messages, {
    temperature: 0.4,
    maxTokens: 1200,
    model: PROVIDER_CONFIG.deepseek.defaultModel,
  })

  return { answer: response.content.trim() }
}

/** Search the web for a selected term only when the reader explicitly asks for it. */
export async function searchSelection(
  text: string,
  context: PageContext | undefined,
  tavilyKey?: string
): Promise<ReadingSearchResponse> {
  if (!tavilyKey) {
    throw new Error('Server Tavily API key is not configured')
  }

  const queryParts = [text.trim().slice(0, 2000)]
  if (context?.title) queryParts.push(`from page: ${context.title.slice(0, 160)}`)
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: queryParts.join(' '),
      search_depth: 'basic',
      max_results: 3,
      include_answer: true,
      include_raw_content: false,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Web search failed (${response.status}): ${detail.slice(0, 240)}`)
  }

  const payload = (await response.json()) as {
    answer?: unknown
    results?: Array<{ title?: unknown; url?: unknown; content?: unknown }>
  }
  const results: ReadingSearchResult[] = (payload.results || [])
    .filter(
      (item): item is { title: string; url: string; content?: string } =>
        typeof item?.title === 'string' && typeof item?.url === 'string'
    )
    .slice(0, 3)
    .map((item) => {
      let domain = item.url
      try {
        domain = new URL(item.url).hostname.replace(/^www\./, '')
      } catch {
        // Keep the URL as a readable fallback when a provider returns an unusual URL.
      }
      return {
        title: item.title,
        url: item.url,
        domain,
        content: typeof item.content === 'string' ? item.content : '',
      }
    })

  return {
    answer: typeof payload.answer === 'string' ? payload.answer.trim() : undefined,
    results,
  }
}
