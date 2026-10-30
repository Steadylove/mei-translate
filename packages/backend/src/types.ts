/**
 * Type definitions for Mei Lingua
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

// Internal server-managed provider credentials. Never expose these to the extension.
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

// Environment bindings
export interface Env {
  // KV Namespace
  TRANSLATION_CACHE: KVNamespace

  // D1 Database
  DB: D1Database

  // Server-side AI configuration. The key must never be sent by the extension.
  DEEPSEEK_API_KEY?: string
  // Optional server-side web search configuration. The key must never be sent by the extension.
  TAVILY_API_KEY?: string

  // Configuration
  CORS_ORIGIN?: string
}

// Translation request/response
export interface TranslateRequest {
  text: string
  targetLang: string
  sourceLang?: string
  context?: PageContext
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

export interface ReadingExplainRequest {
  text: string
  targetLang: string
  context?: PageContext
}

export interface ReadingExplainResponse {
  explanation: string
  termExplanations: Array<{ term: string; explanation: string }>
}

export interface ReadingAskRequest {
  text: string
  question: string
  targetLang: string
  context?: PageContext
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface ReadingAskResponse {
  answer: string
}

export interface ReadingSearchRequest {
  text: string
  context?: PageContext
}

export interface ReadingSearchResult {
  title: string
  url: string
  domain: string
  content: string
}

export interface ReadingSearchResponse {
  answer?: string
  results: ReadingSearchResult[]
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

// Refine translation request
export interface RefineRequest {
  originalText: string
  currentTranslation: string
  instruction: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  targetLang: string
  sourceLang?: string
}

export interface InternalRefineRequest extends RefineRequest {
  apiKeys: UserApiKeys
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
