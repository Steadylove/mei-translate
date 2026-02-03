/**
 * Chrome Storage Service
 * Wrapper around Chrome's storage API for easier usage
 */

// All supported model providers
export type ModelProvider =
  | 'openai'
  | 'claude'
  | 'deepseek'
  | 'gemini'
  | 'qwen'
  | 'moonshot'
  | 'zhipu'
  | 'groq'

// User-configured API keys
export interface UserApiKeys {
  openai?: string
  claude?: string
  deepseek?: string
  gemini?: string
  qwen?: string
  moonshot?: string
  zhipu?: string
  groq?: string
}

// Provider configuration with available models
export const PROVIDER_CONFIG: Record<
  ModelProvider,
  {
    name: string
    models: { id: string; name: string }[]
    defaultModel: string
    docsUrl: string
    placeholder: string
  }
> = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    defaultModel: 'gpt-4o-mini',
    docsUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...',
  },
  claude: {
    name: 'Claude',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fast)' },
    ],
    defaultModel: 'claude-3-5-sonnet-latest',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-...',
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
    ],
    defaultModel: 'deepseek-chat',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    placeholder: 'sk-...',
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-pro', name: 'Gemini Pro' },
    ],
    defaultModel: 'gemini-1.5-flash',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIza...',
  },
  qwen: {
    name: '通义千问',
    models: [
      { id: 'qwen-turbo', name: 'Qwen Turbo' },
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
    ],
    defaultModel: 'qwen-turbo',
    docsUrl: 'https://dashscope.console.aliyun.com/apiKey',
    placeholder: 'sk-...',
  },
  moonshot: {
    name: '月之暗面 Kimi',
    models: [
      { id: 'moonshot-v1-8k', name: 'Moonshot 8K' },
      { id: 'moonshot-v1-32k', name: 'Moonshot 32K' },
      { id: 'moonshot-v1-128k', name: 'Moonshot 128K' },
    ],
    defaultModel: 'moonshot-v1-8k',
    docsUrl: 'https://platform.moonshot.cn/console/api-keys',
    placeholder: 'sk-...',
  },
  zhipu: {
    name: '智谱 GLM',
    models: [
      { id: 'glm-4-flash', name: 'GLM-4 Flash (Free)' },
      { id: 'glm-4', name: 'GLM-4' },
      { id: 'glm-4-plus', name: 'GLM-4 Plus' },
    ],
    defaultModel: 'glm-4-flash',
    docsUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    placeholder: 'xxx.xxx',
  },
  groq: {
    name: 'Groq (Fast)',
    models: [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    ],
    defaultModel: 'llama-3.1-8b-instant',
    docsUrl: 'https://console.groq.com/keys',
    placeholder: 'gsk_...',
  },
}

export interface StorageData {
  // Basic settings
  targetLanguage: string
  blackList: string[]
  webTransEnabled: boolean
  selectionTransEnabled: boolean
  autoSpeak: boolean

  // LLM settings
  apiKeys: UserApiKeys
  selectedProvider: ModelProvider | null
  selectedModel: string | null
}

const DEFAULT_SETTINGS: StorageData = {
  targetLanguage: 'zh',
  blackList: [],
  webTransEnabled: true,
  selectionTransEnabled: true,
  autoSpeak: false,

  // LLM settings - empty by default, user configures
  apiKeys: {},
  selectedProvider: null,
  selectedModel: null,
}

/**
 * Get a value from storage
 */
export async function get<K extends keyof StorageData>(
  key: K,
  defaultValue?: StorageData[K]
): Promise<StorageData[K]> {
  const result = await chrome.storage.sync.get(key)
  return result[key] ?? defaultValue ?? DEFAULT_SETTINGS[key]
}

/**
 * Get multiple values from storage
 */
export async function getMultiple<K extends keyof StorageData>(
  keys: K[]
): Promise<Pick<StorageData, K>> {
  const result = await chrome.storage.sync.get(keys)
  const data = {} as Pick<StorageData, K>

  for (const key of keys) {
    data[key] = result[key] ?? DEFAULT_SETTINGS[key]
  }

  return data
}

/**
 * Set a value in storage
 */
export async function set<K extends keyof StorageData>(
  key: K,
  value: StorageData[K]
): Promise<void> {
  await chrome.storage.sync.set({ [key]: value })
}

/**
 * Set multiple values in storage
 */
export async function setMultiple(data: Partial<StorageData>): Promise<void> {
  await chrome.storage.sync.set(data)
}

/**
 * Remove a value from storage
 */
export async function remove(key: keyof StorageData): Promise<void> {
  await chrome.storage.sync.remove(key)
}

/**
 * Get all settings
 */
export async function getAllSettings(): Promise<StorageData> {
  const result = await chrome.storage.sync.get(null)
  return { ...DEFAULT_SETTINGS, ...result }
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  await chrome.storage.sync.clear()
  await chrome.storage.sync.set(DEFAULT_SETTINGS)
}

/**
 * Get API keys for translation request
 */
export async function getApiKeys(): Promise<UserApiKeys> {
  const result = await chrome.storage.sync.get('apiKeys')
  return result.apiKeys ?? {}
}

/**
 * Set API key for a provider
 */
export async function setApiKey(provider: ModelProvider, apiKey: string): Promise<void> {
  const apiKeys = await getApiKeys()
  if (apiKey) {
    apiKeys[provider] = apiKey
  } else {
    delete apiKeys[provider]
  }
  await chrome.storage.sync.set({ apiKeys })
}

/**
 * Get selected provider and model
 */
export async function getSelectedModel(): Promise<{
  provider: ModelProvider | null
  model: string | null
}> {
  const result = await chrome.storage.sync.get(['selectedProvider', 'selectedModel'])
  return {
    provider: result.selectedProvider ?? null,
    model: result.selectedModel ?? null,
  }
}

/**
 * Set selected provider and model
 */
export async function setSelectedModel(provider: ModelProvider, model: string): Promise<void> {
  await chrome.storage.sync.set({
    selectedProvider: provider,
    selectedModel: model,
  })
}

/**
 * Check if any LLM is configured
 */
export async function hasLLMConfigured(): Promise<boolean> {
  const apiKeys = await getApiKeys()
  return Object.values(apiKeys).some((key) => key && key.length > 0)
}

/**
 * Add listener for storage changes
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      callback(changes)
    }
  })
}

export const Storage = {
  get,
  getMultiple,
  set,
  setMultiple,
  remove,
  getAllSettings,
  resetSettings,
  getApiKeys,
  setApiKey,
  getSelectedModel,
  setSelectedModel,
  hasLLMConfigured,
  onStorageChange,
  PROVIDER_CONFIG,
}

export default Storage
