/**
 * DeepSeek Provider
 * Uses OpenAI-compatible API format
 */

import { BaseLLMProvider, type ChatOptions } from './base'
import type { ChatMessage, LLMResponse } from '../types'

export class DeepSeekProvider extends BaseLLMProvider {
  name = 'deepseek'

  constructor(apiKey: string) {
    super(apiKey, 'https://api.deepseek.com', 'deepseek-chat')
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMResponse> {
    const model = options?.model || this.defaultModel

    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 4096,
      }),
    })

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
      model: string
    }

    return {
      content: data.choices[0]?.message?.content || '',
      tokensUsed: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
      },
      model: data.model,
    }
  }
}
