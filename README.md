# Web Translator

AI-powered translation Chrome extension with multi-model LLM backend.

## Monorepo Structure

```
webtrans-ext/
├── packages/
│   ├── extension/          # Chrome Extension (React + Vite)
│   │   ├── src/
│   │   │   ├── content/    # Content script (page injection)
│   │   │   ├── popup/      # Extension popup
│   │   │   ├── options/    # Settings & PDF viewer
│   │   │   ├── background/ # Service worker
│   │   │   └── services/   # API client
│   │   └── dist/           # Built extension
│   │
│   └── backend/            # Cloudflare Workers API
│       ├── src/
│       │   ├── routes/     # API endpoints
│       │   ├── agents/     # AI agents (translator, summarizer)
│       │   ├── providers/  # LLM providers (OpenAI, Claude, DeepSeek)
│       │   └── db/         # D1 schema
│       └── wrangler.toml   # Cloudflare config
│
├── package.json            # Root workspace config
└── pnpm-workspace.yaml     # Workspace definition
```

## Features

- **Selection Translation**: Select text for instant translation
- **Page Translation**: Translate entire web pages
- **PDF Translation**: Upload and translate PDFs
- **AI-Powered**: GPT-4o-mini, Claude Haiku, DeepSeek
- **Context-Aware**: Adapts style based on content type
- **Smart Caching**: KV cache for repeated translations
- **Translation Memory**: Learns from past translations

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Cloudflare account (for backend)

### Installation

```bash
# Install all dependencies
pnpm install
```

### Development

Run both frontend and backend in parallel:

```bash
pnpm dev
```

Or run them separately:

```bash
# Terminal 1: Backend API (http://localhost:8787)
pnpm dev:backend

# Terminal 2: Extension (auto-reload)
pnpm dev:extension
```

Then load the extension in Chrome:

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `packages/extension/dist/`

### Build

```bash
# Build both
pnpm build

# Build separately
pnpm build:extension
pnpm build:backend
```

### Deploy Backend

```bash
# Set up Cloudflare resources (first time)
cd packages/backend
wrangler kv:namespace create TRANSLATION_CACHE
wrangler d1 create webtrans-memory

# Set API keys
wrangler secret put DEEPSEEK_API_KEY

# Deploy
pnpm deploy:backend
```

## Configuration

### Environment Variables

Update `packages/extension/vite.config.ts` to set your production API URL:

```typescript
'import.meta.env.VITE_API_URL': JSON.stringify(
  mode === 'development'
    ? 'http://localhost:8787'
    : 'https://your-api.workers.dev'  // ← Change this
),
```

### API Keys

Set these secrets in Cloudflare:

```bash
wrangler secret put DEEPSEEK_API_KEY   # Required (cheapest)
wrangler secret put OPENAI_API_KEY     # Optional
wrangler secret put ANTHROPIC_API_KEY  # Optional
```

## API Endpoints

| Endpoint                | Method   | Description           |
| ----------------------- | -------- | --------------------- |
| `/api/translate`        | POST     | Translate single text |
| `/api/translate/batch`  | POST     | Batch translate       |
| `/api/translate/detect` | POST     | Detect language       |
| `/api/context`          | POST     | Analyze page context  |
| `/api/summary`          | POST     | Summarize content     |
| `/api/memory`           | GET/POST | Translation memory    |

## Keyboard Shortcuts

| Shortcut    | Action                  |
| ----------- | ----------------------- |
| Alt+Shift+T | Toggle page translation |
| Alt+Shift+D | Open translation box    |

## Cost Estimation

| Usage  | Words/Month | Est. Cost |
| ------ | ----------- | --------- |
| Light  | 100K        | ~$0.5     |
| Medium | 500K        | ~$2-3     |
| Heavy  | 2M          | ~$8-10    |

_With caching: 30-50% savings_

## License

MIT
