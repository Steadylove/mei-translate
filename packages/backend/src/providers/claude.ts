/**
 * Anthropic Claude Provider
 */

import { BaseLLMProvider, type ChatOptions } from './base'
import type { ChatMessage, LLMResponse } from '../types'

export class ClaudeProvider extends BaseLLMProvider {
  name = 'claude'

  constructor(apiKey: string) {
    super(apiKey, 'https://api.anthropic.com/v1', 'claude-3-haiku-20240307')
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMResponse> {
    const model = options?.model || this.defaultModel

    // Extract system message
    const systemMessage = messages.find((m) => m.role === 'system')?.content || ''
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const response = await this.fetchWithRetry(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: options?.maxTokens ?? 4096,
        system: systemMessage,
        messages: chatMessages,
      }),
    })

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>
      usage: {
        input_tokens: number
        output_tokens: number
      }
      model: string
    }

    const textContent = data.content.find((c) => c.type === 'text')?.text || ''

    return {
      content: textContent,
      tokensUsed: {
        prompt: data.usage.input_tokens,
        completion: data.usage.output_tokens,
        total: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
    }
  }
}
