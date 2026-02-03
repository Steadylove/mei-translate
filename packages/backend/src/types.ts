/**
 * Type definitions for the AI Translation Agent
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

// User-provided API keys (from frontend settings)
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

// Environment bindings (optional now, user keys take priority)
export interface Env {
  // KV Namespace
  TRANSLATION_CACHE: KVNamespace

  // D1 Database
  DB: D1Database

  // API Keys (secrets) - optional fallback, user keys preferred
  OPENAI_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  DEEPSEEK_API_KEY?: string
  GOOGLE_API_KEY?: string
  DASHSCOPE_API_KEY?: string
  MOONSHOT_API_KEY?: string
  ZHIPU_API_KEY?: string
  GROQ_API_KEY?: string

  // Configuration
  DEFAULT_MODEL?: string
  CORS_ORIGIN?: string
}

export interface ModelConfig {
  provider: ModelProvider
  model: string
  apiKey: string
  baseUrl: string
  costPer1kTokens: number
  bestFor: string[]
}

// Translation request/response
export interface TranslateRequest {
  text: string
  targetLang: string
  sourceLang?: string
  context?: PageContext
  model?: ModelProvider
  modelId?: string // Specific model ID (e.g., 'gpt-4o-mini')
  apiKeys?: UserApiKeys // User-provided API keys
  useCache?: boolean
  useMemory?: boolean
}

export interface TranslateResponse {
  translatedText: string
  sourceLang: string
  targetLang: string
  model: ModelProvider
  cached: boolean
  tokensUsed?: number
  cost?: number
}

// Batch translation
export interface BatchTranslateRequest {
  texts: string[]
  targetLang: string
  sourceLang?: string
  context?: PageContext
  model?: ModelProvider
  apiKeys?: UserApiKeys
}

export interface BatchTranslateResponse {
  translations: string[]
  sourceLang: string
  targetLang: string
  model: ModelProvider
  tokensUsed?: number
}

// Page context for context-aware translation
export interface PageContext {
  type: 'technical' | 'news' | 'academic' | 'casual' | 'legal' | 'medical' | 'general'
  domain?: string
  tone: 'formal' | 'informal' | 'neutral'
  terminologyHints?: string[]
  url?: string
  title?: string
}

// Summary request/response
export interface SummaryRequest {
  text: string
  targetLang?: string
  maxLength?: number
  includeKeyPoints?: boolean
  apiKeys?: UserApiKeys
  model?: ModelProvider
}

export interface SummaryResponse {
  summary: string
  summaryTranslated?: string
  keyPoints: string[]
  keyPointsTranslated?: string[]
  estimatedReadTime: number
  sections?: SectionSummary[]
}

export interface SectionSummary {
  title: string
  summary: string
  startIndex: number
  endIndex: number
}

// Context analysis
export interface ContextAnalysisRequest {
  content: string
  url?: string
  title?: string
}

export interface ContextAnalysisResponse {
  context: PageContext
  confidence: number
}

// Translation memory
export interface TranslationMemoryEntry {
  id?: number
  sourceHash: string
  sourceText: string
  targetText: string
  sourceLang: string
  targetLang: string
  contextType?: string
  modelUsed: string
  qualityScore?: number
  useCount: number
  createdAt: string
  updatedAt: string
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    cached?: boolean
    model?: string
    tokensUsed?: number
    processingTime?: number
    llmConfigured?: boolean
    free?: boolean
  }
}

// LLM Message format
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  tokensUsed: {
    prompt: number
    completion: number
    total: number
  }
  model: string
}
