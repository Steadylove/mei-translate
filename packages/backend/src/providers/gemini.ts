/**
 * Google Gemini Provider
 */

import { BaseLLMProvider, type ChatOptions } from './base'
import type { ChatMessage, LLMResponse } from '../types'

export class GeminiProvider extends BaseLLMProvider {
  name = 'gemini'

  constructor(apiKey: string) {
    super(apiKey, 'https://generativelanguage.googleapis.com/v1beta', 'gemini-1.5-flash')
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMResponse> {
    const model = options?.model || this.defaultModel

    // Convert messages to Gemini format
    const systemInstruction = messages.find((m) => m.role === 'system')?.content
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          generationConfig: {
            temperature: options?.temperature ?? 0.7,
            maxOutputTokens: options?.maxTokens ?? 4096,
          },
        }),
      }
    )

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> }
      }>
      usageMetadata?: {
        promptTokenCount: number
        candidatesTokenCount: number
        totalTokenCount: number
      }
    }

    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return {
      content: textContent,
      tokensUsed: {
        prompt: data.usageMetadata?.promptTokenCount || 0,
        completion: data.usageMetadata?.candidatesTokenCount || 0,
        total: data.usageMetadata?.totalTokenCount || 0,
      },
      model,
    }
  }
}
