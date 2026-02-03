/**
 * Free Translation Providers
 * No API key required, suitable for fallback or high-volume basic translation
 * Uses RACE mode with AbortController - first success cancels others
 */

export interface FreeTranslateResult {
  translatedText: string
  detectedSourceLang?: string
  provider: 'mymemory' | 'lingva' | 'google-direct'
}

/**
 * Google Translate Direct (unofficial)
 * Fastest option - direct call to Google's translation endpoint
 */
export async function translateWithGoogleDirect(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<FreeTranslateResult> {
  const src = sourceLang === 'auto' ? 'auto' : sourceLang
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Google Direct error: ${response.status}`)
  }

  const data = await response.json()

  // Response format: [[["translated","original",null,null,10]],null,"en",...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Invalid Google response format')
  }

  const translatedText = data[0].map((item: unknown[]) => item[0]).join('')
  const detectedLang = data[2] as string | undefined

  return {
    translatedText,
    detectedSourceLang: detectedLang,
    provider: 'google-direct',
  }
}

/**
 * MyMemory Translation API
 * Free: 5000 words/day without API key
 */
export async function translateWithMyMemory(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<FreeTranslateResult> {
  const src = sourceLang === 'auto' ? 'autodetect' : sourceLang
  const langPair = `${src}|${targetLang}`
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langPair)}`

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`MyMemory API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    responseStatus: number
    responseData: {
      translatedText: string
      detectedLanguage?: string
    }
    quotaFinished?: boolean
  }

  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory translation failed: ${data.responseStatus}`)
  }

  if (data.quotaFinished) {
    throw new Error('MyMemory daily quota exceeded')
  }

  return {
    translatedText: data.responseData.translatedText,
    detectedSourceLang: data.responseData.detectedLanguage,
    provider: 'mymemory',
  }
}

/**
 * Lingva Translate API
 * Free Google Translate alternative
 */
export async function translateWithLingva(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal
): Promise<FreeTranslateResult> {
  const src = sourceLang === 'auto' ? 'auto' : sourceLang
  const url = `https://lingva.ml/api/v1/${src}/${targetLang}/${encodeURIComponent(text)}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'WebTranslator/1.0',
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Lingva API error: ${response.status}`)
  }

  const data = (await response.json()) as {
    translation: string
  }

  return {
    translatedText: data.translation,
    provider: 'lingva',
  }
}

/**
 * RACE mode with cancellation: All providers run in parallel
 * First successful result wins and cancels all others to save bandwidth
 */
export async function freeTranslate(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string
): Promise<FreeTranslateResult> {
  // Normalize language codes
  const srcLang = sourceLang === 'auto' ? 'auto' : sourceLang.toLowerCase().split('-')[0]
  const tgtLang = targetLang.toLowerCase().split('-')[0]

  console.log(`[FreeTranslate] Racing providers for: "${text.substring(0, 30)}..."`)

  // Create AbortController to cancel other requests when one succeeds
  const controller = new AbortController()
  const { signal } = controller

  // Create all translation promises
  const providers = [
    {
      name: 'google-direct',
      fn: () => translateWithGoogleDirect(text, srcLang, tgtLang, signal),
    },
    {
      name: 'mymemory',
      fn: () => translateWithMyMemory(text, srcLang, tgtLang, signal),
    },
    {
      name: 'lingva',
      fn: () => translateWithLingva(text, srcLang, tgtLang, signal),
    },
  ]

  // Wrap each provider to track which one wins
  const racePromises = providers.map(async (provider) => {
    try {
      const result = await provider.fn()
      // This provider won! Abort others
      console.log(`[FreeTranslate] Winner: ${provider.name}, aborting others`)
      controller.abort()
      return result
    } catch (error) {
      // Check if this was an abort (expected for losers)
      if ((error as Error).name === 'AbortError') {
        throw new Error(`${provider.name} aborted (another provider won)`)
      }
      throw error
    }
  })

  try {
    // Promise.any returns the first fulfilled promise
    const result = await Promise.any(racePromises)
    return result
  } catch (error) {
    // All providers failed
    if (error instanceof AggregateError) {
      const errors = error.errors
        .filter((e: Error) => !e.message.includes('aborted'))
        .map((e: Error) => e.message)
        .join('; ')
      throw new Error(`All providers failed: ${errors || 'unknown error'}`)
    }
    throw error
  }
}

/**
 * Fast language detection using Google
 */
export async function detectLanguage(text: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 3000)

  try {
    const result = await translateWithGoogleDirect(
      text.slice(0, 100),
      'auto',
      'en',
      controller.signal
    )
    clearTimeout(timeoutId)
    return result.detectedSourceLang || 'en'
  } catch {
    clearTimeout(timeoutId)
    // Fallback: simple heuristic
    const chineseRegex = /[\u4e00-\u9fa5]/g
    const matches = text.match(chineseRegex)
    return matches && matches.length > text.length * 0.3 ? 'zh' : 'en'
  }
}
