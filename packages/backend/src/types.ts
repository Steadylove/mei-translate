/**
 * Type definitions for the AI Translation Agent
 */

// Environment bindings
export interface Env {
  // KV Namespace
  TRANSLATION_CACHE: KVNamespace

  // D1 Database
  DB: D1Database

  // API Keys (secrets)
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY: string
  DEEPSEEK_API_KEY: string

  // Configuration
  DEFAULT_MODEL: string
  CORS_ORIGIN: string
}

// Model provider types
export type ModelProvider = 'openai' | 'claude' | 'deepseek'

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
