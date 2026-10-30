# Mei Lingua Backend

A Cloudflare Workers-based backend for translation and Reading Agent assistance.

## Features

- 🌐 **Server-Managed AI**: DeepSeek Chat is used for translation and Reading Agent features
- 🧠 **Fixed Model**: Uses the server-managed DeepSeek Chat model
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

3. Set the server-side DeepSeek key:

```bash
wrangler secret put DEEPSEEK_API_KEY
```

To enable the explicit “Search web” action in the Reading Agent, also configure Tavily:

```bash
wrangler secret put TAVILY_API_KEY
```

Without this optional secret, the Reading Agent continues to support translation, explanations,
and follow-up questions while the search action returns a clear configuration error.

The extension never sends or stores an LLM API key. Provider and model selection are fixed on the server.

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

### Reading Agent

#### POST /api/reading/explain

Explain selected text using the server-managed DeepSeek model and hidden page context.

#### POST /api/reading/ask

Ask a follow-up question about selected text and page context.

#### POST /api/reading/search

Search the web after the reader explicitly clicks “Search web”. This endpoint requires the
optional server-side `TAVILY_API_KEY` secret and returns up to three source links.

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

| Provider | Model         | Cost per 1K tokens           |
| -------- | ------------- | ---------------------------- |
| DeepSeek | deepseek-chat | See current DeepSeek pricing |

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
