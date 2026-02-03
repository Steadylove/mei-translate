/**
 * Alibaba Qwen (通义千问) Provider
 */

import { BaseLLMProvider, type ChatOptions } from './base'
import type { ChatMessage, LLMResponse } from '../types'

export class QwenProvider extends BaseLLMProvider {
  name = 'qwen'

  constructor(apiKey: string) {
    super(apiKey, 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-turbo')
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
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
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
