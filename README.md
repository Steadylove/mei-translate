# MeiTrans - AI-Powered Web Translator

[中文文档](./README.zh-CN.md)

<p align="center">
  <strong>A Chrome extension for intelligent translation powered by multiple AI models</strong>
</p>

<p align="center">
  Machine Translation + LLM Translation | PDF Translation | TTS | 8 AI Providers
</p>

---

## Features

### Core Translation

- **Selection Translation** - Select text on any webpage, get instant dual translation (machine + AI)
- **Full Page Translation** - Translate entire web pages with one click
- **PDF Translation** - Upload PDFs, select text, auto-translate with split-panel view
- **Context-Aware** - Automatically detects content type (tech, news, academic, etc.) for better results

### AI & LLM

- **8 AI Providers** - OpenAI, Claude, DeepSeek, Gemini, Qwen, Moonshot, Zhipu GLM, Groq
- **Dual Translation** - Machine translation (fast, free) + AI translation (high quality) shown side by side
- **User-Configured Keys** - Bring your own API keys, switch models anytime
- **Smart Caching** - Translation results are cached to reduce API costs

### User Experience

- **Text-to-Speech** - Listen to original and translated text
- **Draggable Panels** - Reposition translation popups freely
- **Keyboard Shortcuts** - `Alt+Shift+T` for page translation, `Alt+Shift+D` for input box
- **Site Blacklist** - Disable on specific websites
- **Translation Memory** - Learns from past translations

## Architecture

```
webtrans-ext/
├── packages/
│   ├── extension/          # Chrome Extension (React + TypeScript + Vite)
│   │   ├── src/
│   │   │   ├── popup/      # Extension popup UI
│   │   │   ├── options/    # Settings page & PDF viewer
│   │   │   ├── content/    # Content script (injected into pages)
│   │   │   ├── background/ # Service worker
│   │   │   ├── hooks/      # React hooks (useTranslate, useTTS, etc.)
│   │   │   ├── services/   # API services & storage
│   │   │   └── components/ # Reusable UI components
│   │   └── dist/           # Built extension (load this in Chrome)
│   │
│   └── backend/            # API Server (Cloudflare Workers + Hono)
│       └── src/
│           ├── routes/     # API endpoints
│           ├── providers/  # LLM provider adapters
│           ├── agents/     # Translation, summarization, context analysis
│           └── utils/      # Caching, hashing utilities
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Install & Run

```bash
# Install dependencies
pnpm install

# Start development (extension + backend)
pnpm dev
```

### Load Extension in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `packages/extension/dist`

### Configure AI Models

1. Click the extension icon → **More Settings**
2. Add your API key for any provider (OpenAI, Claude, DeepSeek, etc.)
3. Click **Use** to activate, select your preferred model

> Machine translation works without any API key. AI translation requires at least one configured provider.

## Development

```bash
# Run everything
pnpm dev

# Run only extension (with HMR for popup/options)
pnpm dev:extension

# Run only backend
pnpm dev:backend

# Build for production
pnpm build

# Build extension only (dev mode, localhost API)
cd packages/extension && pnpm build:dev

# Build extension only (production, deployed API)
cd packages/extension && pnpm build

# Lint & format
pnpm lint
pnpm format
```

## Deployment

### Backend (Cloudflare Workers)

```bash
cd packages/backend

# First time: initialize resources
./deploy.sh init      # Creates KV namespace + D1 database
# Edit wrangler.toml with the generated IDs
./deploy.sh migrate   # Initialize database tables
./deploy.sh deploy    # Deploy to Cloudflare
```

Free tier includes:

- 100,000 requests/day
- 5 GB D1 storage
- KV caching

### Extension

After deploying the backend, update the API URL in `packages/extension/vite.config.ts`, then:

```bash
cd packages/extension
pnpm build            # Production build
```

Load the `dist` folder in Chrome, or package as `.crx` for distribution.

## API Endpoints

| Endpoint                   | Method | Description                                |
| -------------------------- | ------ | ------------------------------------------ |
| `/api/translate`           | POST   | Single text translation (requires API key) |
| `/api/translate/dual`      | POST   | Dual translation (machine + AI)            |
| `/api/translate/free`      | POST   | Free machine translation                   |
| `/api/translate/batch`     | POST   | Batch translation (up to 50 texts)         |
| `/api/translate/detect`    | POST   | Language detection                         |
| `/api/translate/providers` | GET    | List available AI providers                |
| `/api/context`             | POST   | Context analysis                           |
| `/api/summary`             | POST   | Text summarization                         |
| `/api/memory/*`            | CRUD   | Translation memory                         |

## Supported Languages

Chinese, English, Japanese, Korean, French, German, Spanish, Russian, Arabic, Portuguese

## Keyboard Shortcuts

| Shortcut      | Action                     |
| ------------- | -------------------------- |
| `Alt+Shift+T` | Toggle page translation    |
| `Alt+Shift+D` | Open translation input box |
| `Esc`         | Close translation popup    |

## Tech Stack

| Component | Technology                                |
| --------- | ----------------------------------------- |
| Extension | React 18, TypeScript, Vite, Tailwind CSS  |
| Backend   | Cloudflare Workers, Hono, D1 (SQLite), KV |
| PDF       | PDF.js (Mozilla)                          |
| TTS       | Web Speech API                            |
| Monorepo  | pnpm workspaces                           |

## License

MIT
