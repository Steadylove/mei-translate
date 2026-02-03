/**
 * Translation Agent
 * Handles translation with context awareness and smart model routing
 * Supports user-provided API keys
 */

import type {
  Env,
  ModelProvider,
  PageContext,
  ChatMessage,
  LLMResponse,
  UserApiKeys,
} from '../types'
import { getProviderWithKey, getFirstAvailableProvider, PROVIDER_CONFIG } from '../providers'
import { getCachedTranslation, setCachedTranslation, getBatchCached } from '../utils/cache'
import { hashText } from '../utils/hash'

export interface TranslationResult {
  translatedText: string
  sourceLang: string
  targetLang: string
  model: ModelProvider
  cached: boolean
  tokensUsed?: number
}

/**
 * Detect language of text using simple heuristics
 */
export function detectLanguage(text: string): string {
  // Check for Chinese characters
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh'
  // Check for Japanese (Hiragana/Katakana)
  if (/[\u3040-\u30ff]/.test(text)) return 'ja'
  // Check for Korean
  if (/[\uac00-\ud7af]/.test(text)) return 'ko'
  // Check for Cyrillic (Russian)
  if (/[\u0400-\u04ff]/.test(text)) return 'ru'
  // Check for Arabic
  if (/[\u0600-\u06ff]/.test(text)) return 'ar'
  // Default to English
  return 'en'
}

/**
 * Build translation prompt based on context
 */
function buildTranslationPrompt(
  text: string,
  targetLang: string,
  sourceLang: string,
  context?: PageContext
): ChatMessage[] {
  const langNames: Record<string, string> = {
    en: 'English',
    zh: 'Chinese (Simplified)',
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ru: 'Russian',
    ar: 'Arabic',
    pt: 'Portuguese',
  }

  const targetLangName = langNames[targetLang] || targetLang
  const sourceLangName = langNames[sourceLang] || sourceLang

  let systemPrompt = `You are a professional translator. Translate the text from ${sourceLangName} to ${targetLangName}.`

  if (context) {
    systemPrompt += `\n\nContext: This is ${context.type} content`
    if (context.domain) {
      systemPrompt += ` about ${context.domain}`
    }
    systemPrompt += `. Use a ${context.tone} tone.`

    if (context.terminologyHints && context.terminologyHints.length > 0) {
      systemPrompt += `\n\nKey terms to maintain consistency: ${context.terminologyHints.join(', ')}`
    }
  }

  systemPrompt += `

Rules:
1. Translate accurately while maintaining natural flow
2. Preserve the original meaning and intent
3. Keep proper nouns, code, and technical terms as appropriate
4. Do not add explanations or notes, only output the translation
5. Maintain the same paragraph structure`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text },
  ]
}

/**
 * Translate with user-provided API keys
 */
export async function translateWithUserKeys(
  env: Env,
  text: string,
  targetLang: string,
  apiKeys: UserApiKeys,
  options: {
    sourceLang?: string
    context?: PageContext
    model?: ModelProvider
    modelId?: string
    useCache?: boolean
    useMemory?: boolean
  } = {}
): Promise<TranslationResult> {
  const {
    sourceLang = detectLanguage(text),
    context,
    model: preferredModel,
    modelId,
    useCache = true,
  } = options

  // Don't translate if source and target are the same
  if (sourceLang === targetLang) {
    return {
      translatedText: text,
      sourceLang,
      targetLang,
      model: preferredModel || 'openai',
      cached: false,
      tokensUsed: 0,
    }
  }

  // Check cache first
  if (useCache) {
    const cached = await getCachedTranslation(env, text, sourceLang, targetLang, context?.type)
    if (cached) {
      return {
        translatedText: cached.translatedText,
        sourceLang,
        targetLang,
        model: cached.model as ModelProvider,
        cached: true,
        tokensUsed: 0,
      }
    }
  }

  // Get the provider and API key to use
  let selectedProvider: ModelProvider
  let apiKey: string

  if (preferredModel && apiKeys[preferredModel]) {
    // User specified a model and has the key
    selectedProvider = preferredModel
    apiKey = apiKeys[preferredModel]!
  } else {
    // Auto-select based on available keys
    const available = getFirstAvailableProvider(apiKeys)
    if (!available) {
      throw new Error('No API key configured')
    }
    selectedProvider = available.provider
    apiKey = available.apiKey
  }

  console.log(`[Translator] Using provider: ${selectedProvider}`)

  // Build prompt
  const messages = buildTranslationPrompt(text, targetLang, sourceLang, context)

  // Get provider instance and translate
  const provider = getProviderWithKey(selectedProvider, apiKey)

  // Use specific model if provided, otherwise use provider default
  const specificModel = modelId || PROVIDER_CONFIG[selectedProvider].defaultModel

  const response: LLMResponse = await provider.chat(messages, {
    temperature: 0.3,
    maxTokens: Math.max(text.length * 3, 1000),
    model: specificModel,
  })

  const translatedText = response.content.trim()

  // Cache the result
  if (useCache && translatedText) {
    await setCachedTranslation(
      env,
      text,
      sourceLang,
      targetLang,
      translatedText,
      selectedProvider,
      context?.type
    )
  }

  return {
    translatedText,
    sourceLang,
    targetLang,
    model: selectedProvider,
    cached: false,
    tokensUsed: response.tokensUsed.total,
  }
}

/**
 * Batch translate multiple texts with user API keys
 */
export async function translateBatch(
  env: Env,
  texts: string[],
  targetLang: string,
  apiKeys: UserApiKeys,
  options: {
    sourceLang?: string
    context?: PageContext
    model?: ModelProvider
    useCache?: boolean
  } = {}
): Promise<{
  translations: string[]
  sourceLang: string
  targetLang: string
  model: ModelProvider
  cachedCount: number
  tokensUsed: number
}> {
  const { context, model: preferredModel, useCache = true } = options

  // Detect source language from first non-empty text
  const firstText = texts.find((t) => t.trim().length > 0) || ''
  const sourceLang = options.sourceLang || detectLanguage(firstText)

  // Check cache for all texts
  const cachedResults = useCache
    ? await getBatchCached(env, texts, sourceLang, targetLang, context?.type)
    : new Map()

  // Find texts that need translation
  const textsToTranslate = texts.filter((t) => !cachedResults.has(t))

  // Get provider and API key
  let selectedProvider: ModelProvider
  let apiKey: string

  if (preferredModel && apiKeys[preferredModel]) {
    selectedProvider = preferredModel
    apiKey = apiKeys[preferredModel]!
  } else {
    const available = getFirstAvailableProvider(apiKeys)
    if (!available) {
      throw new Error('No API key configured')
    }
    selectedProvider = available.provider
    apiKey = available.apiKey
  }

  let totalTokens = 0
  const newTranslations = new Map<string, string>()

  // Translate uncached texts in batches
  if (textsToTranslate.length > 0) {
    const BATCH_SIZE = 20
    const batches: string[][] = []

    for (let i = 0; i < textsToTranslate.length; i += BATCH_SIZE) {
      batches.push(textsToTranslate.slice(i, i + BATCH_SIZE))
    }

    for (const batch of batches) {
      // Create a batch prompt
      const numberedTexts = batch.map((t, i) => `[${i + 1}] ${t}`).join('\n\n')

      const batchPrompt = buildTranslationPrompt(numberedTexts, targetLang, sourceLang, context)
      batchPrompt[0].content += `\n\nYou will receive multiple texts marked with [number]. Translate each one and keep the [number] markers in your response.`

      const provider = getProviderWithKey(selectedProvider, apiKey)
      const response = await provider.chat(batchPrompt, {
        temperature: 0.3,
        maxTokens: Math.max(numberedTexts.length * 2, 2000),
      })

      totalTokens += response.tokensUsed.total

      // Parse batch response
      const translatedParts = response.content.split(/\n*\[\d+\]\s*/).filter(Boolean)

      batch.forEach((originalText, i) => {
        const translated = translatedParts[i]?.trim() || originalText
        newTranslations.set(originalText, translated)

        // Cache each translation
        if (useCache) {
          setCachedTranslation(
            env,
            originalText,
            sourceLang,
            targetLang,
            translated,
            selectedProvider,
            context?.type
          )
        }
      })
    }
  }

  // Combine cached and new translations in original order
  const translations = texts.map((text) => {
    const cached = cachedResults.get(text)
    if (cached) return cached.translatedText
    return newTranslations.get(text) || text
  })

  return {
    translations,
    sourceLang,
    targetLang,
    model: selectedProvider,
    cachedCount: cachedResults.size,
    tokensUsed: totalTokens,
  }
}

/**
 * Save to translation memory (D1)
 */
export async function saveToMemory(
  env: Env,
  sourceText: string,
  targetText: string,
  sourceLang: string,
  targetLang: string,
  model: string,
  contextType?: string
): Promise<void> {
  try {
    const sourceHash = await hashText(sourceText)

    await env.DB.prepare(
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
        model
      )
      .run()
  } catch (error) {
    console.error('Failed to save to memory:', error)
  }
}

/**
 * Get from translation memory (D1)
 */
export async function getFromMemory(
  env: Env,
  sourceText: string,
  sourceLang: string,
  targetLang: string
): Promise<string | null> {
  try {
    const sourceHash = await hashText(sourceText)

    const result = await env.DB.prepare(
      `
      SELECT target_text FROM translation_memory
      WHERE source_hash = ? AND source_lang = ? AND target_lang = ?
      LIMIT 1
    `
    )
      .bind(sourceHash, sourceLang, targetLang)
      .first<{ target_text: string }>()

    return result?.target_text || null
  } catch (error) {
    console.error('Failed to get from memory:', error)
    return null
  }
}
