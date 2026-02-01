/**
 * LLM Provider Factory
 */

import type { Env, ModelProvider, PageContext } from '../types'
import type { LLMProvider } from './base'
import { OpenAIProvider } from './openai'
import { ClaudeProvider } from './claude'
import { DeepSeekProvider } from './deepseek'

// Model configurations
export const MODEL_CONFIG = {
  openai: {
    model: 'gpt-4o-mini',
    costPer1kTokens: 0.00015,
    bestFor: ['general', 'casual', 'news'],
  },
  claude: {
    model: 'claude-3-haiku-20240307',
    costPer1kTokens: 0.00025,
    bestFor: ['nuanced', 'creative', 'academic'],
  },
  deepseek: {
    model: 'deepseek-chat',
    costPer1kTokens: 0.00014,
    bestFor: ['chinese', 'technical', 'code'],
  },
} as const

/**
 * Get LLM provider instance
 */
export function getProvider(provider: ModelProvider, env: Env): LLMProvider {
  switch (provider) {
    case 'openai':
      if (!env.OPENAI_API_KEY) throw new Error('OpenAI API key not configured')
      return new OpenAIProvider(env.OPENAI_API_KEY)

    case 'claude':
      if (!env.ANTHROPIC_API_KEY) throw new Error('Anthropic API key not configured')
      return new ClaudeProvider(env.ANTHROPIC_API_KEY)

    case 'deepseek':
      if (!env.DEEPSEEK_API_KEY) throw new Error('DeepSeek API key not configured')
      return new DeepSeekProvider(env.DEEPSEEK_API_KEY)

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Smart model selection based on context
 */
export function selectBestModel(
  sourceLang: string,
  targetLang: string,
  context?: PageContext,
  preferredModel?: ModelProvider
): ModelProvider {
  // If user specified a model, use it
  if (preferredModel) {
    return preferredModel
  }

  // Chinese content → DeepSeek (best for Chinese)
  if (sourceLang === 'zh' || targetLang === 'zh') {
    return 'deepseek'
  }

  // Technical content → DeepSeek
  if (context?.type === 'technical') {
    return 'deepseek'
  }

  // Academic content → Claude (better nuance)
  if (context?.type === 'academic') {
    return 'claude'
  }

  // Creative/casual → Claude
  if (context?.type === 'casual' || context?.tone === 'informal') {
    return 'claude'
  }

  // Default to DeepSeek (cheapest and good quality)
  return 'deepseek'
}

/**
 * Calculate estimated cost
 */
export function estimateCost(tokensUsed: number, provider: ModelProvider): number {
  const config = MODEL_CONFIG[provider]
  return (tokensUsed / 1000) * config.costPer1kTokens
}

export { OpenAIProvider, ClaudeProvider, DeepSeekProvider }
