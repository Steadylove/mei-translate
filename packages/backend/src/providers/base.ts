/**
 * Base LLM Provider Interface
 */

import type { ChatMessage, LLMResponse } from '../types'

export interface LLMProvider {
  name: string
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMResponse>
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  model?: string
}

export abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string
  protected apiKey: string
  protected baseUrl: string
  protected defaultModel: string

  constructor(apiKey: string, baseUrl: string, defaultModel: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.defaultModel = defaultModel
  }

  abstract chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMResponse>

  protected async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = 3
  ): Promise<Response> {
    let lastError: Error | null = null

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options)

        if (response.ok) {
          return response
        }

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          const error = await response.text()
          throw new Error(`API error ${response.status}: ${error}`)
        }

        lastError = new Error(`HTTP ${response.status}`)
      } catch (err) {
        lastError = err as Error
      }

      // Wait before retry (exponential backoff)
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000))
      }
    }

    throw lastError || new Error('Request failed')
  }
}
