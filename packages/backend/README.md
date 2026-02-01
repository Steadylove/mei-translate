# AI Translation Agent Backend

A Cloudflare Workers-based backend for intelligent translation using multiple LLM providers.

## Features

- 🌐 **Multi-Model Support**: OpenAI GPT-4o-mini, Claude Haiku, DeepSeek
- 🧠 **Smart Model Routing**: Automatically selects the best model based on content
- 💾 **Translation Memory**: D1 database for caching and learning
- ⚡ **KV Caching**: Fast response for repeated translations
- 📊 **Context-Aware**: Analyzes page type for appropriate translation style
- 📝 **Summary + Translate**: Summarize long content before translating

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account

### Installation

```bash
cd backend
pnpm install
```

### Configuration

1. Create KV namespace and D1 database:

```bash
# Create KV namespace
wrangler kv:namespace create TRANSLATION_CACHE
wrangler kv:namespace create TRANSLATION_CACHE --preview

# Create D1 database
wrangler d1 create webtrans-memory
```

2. Update `wrangler.toml` with the IDs from step 1.

3. Set up API keys:

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put DEEPSEEK_API_KEY
```

4. Run database migrations:

```bash
# Local development
pnpm run d1:migrate

# Production
pnpm run d1:migrate:prod
```

### Development

```bash
pnpm run dev
```

The API will be available at `http://localhost:8787`.

### Deployment

```bash
pnpm run deploy
```

## API Endpoints

### Translation

#### POST /api/translate

Translate a single text.

```json
{
  "text": "Hello, world!",
  "targetLang": "zh",
  "sourceLang": "en",
  "context": {
    "type": "technical",
    "tone": "formal"
  },
  "model": "deepseek",
  "useCache": true,
  "useMemory": true
}
```

#### POST /api/translate/batch

Batch translate multiple texts.

```json
{
  "texts": ["Hello", "World"],
  "targetLang": "zh",
  "sourceLang": "en"
}
```

#### POST /api/translate/detect

Detect language of text.

```json
{
  "text": "你好世界"
}
```

### Context Analysis

#### POST /api/context

Analyze page content for translation context.

```json
{
  "content": "Page content here...",
  "url": "https://example.com",
  "title": "Page Title"
}
```

#### POST /api/context/quick

Quick context detection using URL/title heuristics (no LLM call).

```json
{
  "url": "https://github.com/user/repo",
  "title": "Repository"
}
```

### Summary

#### POST /api/summary

Summarize text content.

```json
{
  "text": "Long text content...",
  "targetLang": "zh",
  "maxLength": 500,
  "includeKeyPoints": true
}
```

#### POST /api/summary/document

Summarize a document with title.

```json
{
  "title": "Document Title",
  "content": "Document content...",
  "targetLang": "zh"
}
```

### Translation Memory

#### GET /api/memory

Get translation memory entries.

Query params: `sourceLang`, `targetLang`, `limit`, `offset`

#### GET /api/memory/search

Search for a specific translation.

Query params: `text`, `sourceLang`, `targetLang`

#### POST /api/memory

Add entry to translation memory.

```json
{
  "sourceText": "Hello",
  "targetText": "你好",
  "sourceLang": "en",
  "targetLang": "zh",
  "contextType": "general",
  "modelUsed": "deepseek"
}
```

#### GET /api/memory/stats

Get translation memory statistics.

## Cost Estimation

| Provider | Model          | Cost per 1K tokens |
| -------- | -------------- | ------------------ |
| OpenAI   | gpt-4o-mini    | $0.00015           |
| Claude   | claude-3-haiku | $0.00025           |
| DeepSeek | deepseek-chat  | $0.00014           |

With caching and memory, expect 30-50% cost savings.

## Architecture

```
src/
├── index.ts           # Worker entry point
├── types.ts           # TypeScript definitions
├── routes/
│   ├── translate.ts   # Translation API
│   ├── summary.ts     # Summary API
│   ├── context.ts     # Context analysis API
│   └── memory.ts      # Translation memory API
├── agents/
│   ├── translator.ts  # Translation agent
│   ├── summarizer.ts  # Summary agent
│   └── context.ts     # Context analysis agent
├── providers/
│   ├── base.ts        # Base LLM provider
│   ├── openai.ts      # OpenAI provider
│   ├── claude.ts      # Claude provider
│   ├── deepseek.ts    # DeepSeek provider
│   └── index.ts       # Provider factory
├── db/
│   └── schema.sql     # D1 database schema
└── utils/
    ├── cache.ts       # KV cache utilities
    └── hash.ts        # Text hashing
```

## Free Tier Limits (Cloudflare)

| Service | Free Quota                          |
| ------- | ----------------------------------- |
| Workers | 100,000 requests/day                |
| KV      | 100,000 reads/day, 1,000 writes/day |
| D1      | 5GB storage, 5M rows read/day       |

## License

MIT
