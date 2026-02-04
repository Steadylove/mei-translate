/**
 * LLM Provider Factory
 * Supports user-configured API keys from request
 */

import type { LLMProvider } from './base'
import { OpenAIProvider } from './openai'
import { ClaudeProvider } from './claude'
import { DeepSeekProvider } from './deepseek'
import { GeminiProvider } from './gemini'
import { QwenProvider } from './qwen'
import { MoonshotProvider } from './moonshot'
import { ZhipuProvider } from './zhipu'
import { GroqProvider } from './groq'

// All supported providers
export type ModelProvider =
  | 'openai'
  | 'claude'
  | 'deepseek'
  | 'gemini'
  | 'qwen'
  | 'moonshot'
  | 'zhipu'
  | 'groq'

// Model configurations with available models for each provider
export const PROVIDER_CONFIG: Record<
  ModelProvider,
  {
    name: string
    models: { id: string; name: string; contextWindow: number }[]
    defaultModel: string
    apiKeyName: string
    docsUrl: string
  }
> = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000 },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', contextWindow: 128000 },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextWindow: 16385 },
    ],
    defaultModel: 'gpt-4o-mini',
    apiKeyName: 'OPENAI_API_KEY',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  claude: {
    name: 'Anthropic Claude',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000 },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', contextWindow: 200000 },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)', contextWindow: 200000 },
    ],
    defaultModel: 'claude-3-5-sonnet-latest',
    apiKeyName: 'ANTHROPIC_API_KEY',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', contextWindow: 64000 },
      { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 64000 },
    ],
    defaultModel: 'deepseek-chat',
    apiKeyName: 'DEEPSEEK_API_KEY',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', contextWindow: 1000000 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', contextWindow: 2000000 },
      { id: 'gemini-pro', name: 'Gemini Pro', contextWindow: 32000 },
    ],
    defaultModel: 'gemini-1.5-flash',
    apiKeyName: 'GOOGLE_API_KEY',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  qwen: {
    name: '通义千问 Qwen',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo', contextWindow: 8000 },
      { id: 'qwen-plus', name: 'Qwen Plus', contextWindow: 32000 },
      { id: 'qwen-max', name: 'Qwen Max', contextWindow: 32000 },
    ],
    defaultModel: 'qwen-turbo',
    apiKeyName: 'DASHSCOPE_API_KEY',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
  moonshot: {
    name: '月之暗面 Kimi',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot 8K', contextWindow: 8000 },
      { id: 'moonshot-v1-32k', name: 'Moonshot 32K', contextWindow: 32000 },
      { id: 'moonshot-v1-128k', name: 'Moonshot 128K', contextWindow: 128000 },
    ],
    defaultModel: 'moonshot-v1-8k',
    apiKeyName: 'MOONSHOT_API_KEY',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
  },
  zhipu: {
    name: '智谱清言 GLM',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash (Free)', contextWindow: 128000 },
      { id: 'glm-4', name: 'GLM-4', contextWindow: 128000 },
      { id: 'glm-4-plus', name: 'GLM-4 Plus', contextWindow: 128000 },
    ],
    defaultModel: 'glm-4-flash',
    apiKeyName: 'ZHIPU_API_KEY',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  groq: {
    name: 'Groq (Fast)',
    models: [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', contextWindow: 131072 },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', contextWindow: 131072 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768 },
    ],
    defaultModel: 'llama-3.1-8b-instant',
    apiKeyName: 'GROQ_API_KEY',
    docsUrl: 'https://console.groq.com/keys',
  },
}

// Re-export UserApiKeys from types
export type { UserApiKeys } from '../types'
import type { UserApiKeys } from '../types'

/**
 * Get LLM provider instance using user-provided API key
 */
export function getProviderWithKey(provider: ModelProvider, apiKey: string): LLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey)
    case 'claude':
      return new ClaudeProvider(apiKey)
    case 'deepseek':
      return new DeepSeekProvider(apiKey)
    case 'gemini':
      return new GeminiProvider(apiKey)
    case 'qwen':
      return new QwenProvider(apiKey)
    case 'moonshot':
      return new MoonshotProvider(apiKey)
    case 'zhipu':
      return new ZhipuProvider(apiKey)
    case 'groq':
      return new GroqProvider(apiKey)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

/**
 * Get first available provider from user's configured keys
 */
export function getFirstAvailableProvider(userKeys: UserApiKeys): {
  provider: ModelProvider
  apiKey: string
} | null {
  const priority: ModelProvider[] = [
    'claude',
    'openai',
    'deepseek',
    'gemini',
    'groq',
    'qwen',
    'moonshot',
    'zhipu',
  ]

  for (const p of priority) {
    const key = userKeys[p]
    if (key) {
      return { provider: p, apiKey: key }
    }
  }
  return null
}

export {
  OpenAIProvider,
  ClaudeProvider,
  DeepSeekProvider,
  GeminiProvider,
  QwenProvider,
  MoonshotProvider,
  ZhipuProvider,
  GroqProvider,
}
